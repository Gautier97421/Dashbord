import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AiError, generateJSON, warmUpVision } from '@/lib/ai/llm'
import { ingredientsSeed, type IngredientSeed } from '@/lib/data/ingredients-seed'
import { createFoodMatcher } from '@/lib/food-matching'
import type { ScannedFood } from '@/lib/nutrition'
import { AI_QUOTA_MESSAGE, takeAiQuota } from '@/lib/rate-limit'

const MAX_IMAGE_BASE64_LENGTH = 8 * 1024 * 1024
const SCAN_TIMEOUT_MS = 180000

const referenceLine = (i: IngredientSeed) =>
  `- ${i.name}${i.unitWeight ? ` [1 ${i.unitLabel} ≈ ${i.unitWeight} g]` : ''}`

const SYSTEM_PROMPT = `Tu es un nutritionniste qui analyse des photos de repas.
Identifie chaque aliment visible et, pour chacun, donne :
- "name" : son nom en français, précis sur la cuisson (ex: "Œuf au plat" et non "œuf brouillé" si le jaune est entier) ;
- "reference" : le nom EXACT d'une entrée de la liste ci-dessous qui correspond dans le même état (cru, cuit, grillé…), sinon "" ;
- "count" : le nombre de pièces si l'aliment se compte (œufs, tranches, steaks, fruits, parts…), sinon 0 ;
- "grams" : le poids total estimé dans l'assiette. N'utilise pas 100 g par défaut : estime la portion réelle (une assiette fait environ 26 cm) ;
- ses valeurs nutritionnelles pour 100 g, dans l'état où il est servi.
Ne liste que ce qui est réellement visible. Sépare les composants d'un plat (féculent, protéine, légumes, sauce).
Attention aux confusions : des tranches longues et fines de porc grillé sont du "Bacon (grillé)", les lardons sont de petits cubes.
Si l'image ne montre pas de nourriture, renvoie une liste vide.

Liste de référence (valeurs pour 100 g, [poids d'une pièce]) :
${ingredientsSeed.map(referenceLine).join('\n')}`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    foods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          reference: { type: 'string' },
          count: { type: 'number' },
          grams: { type: 'number' },
          calories_per_100g: { type: 'number' },
          protein_per_100g: { type: 'number' },
          carbs_per_100g: { type: 'number' },
          fat_per_100g: { type: 'number' },
        },
        required: ['name', 'reference', 'count', 'grams', 'calories_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fat_per_100g'],
        additionalProperties: false,
      },
    },
  },
  required: ['foods'],
  additionalProperties: false,
}

const findReference = createFoodMatcher(ingredientsSeed)

// Mode étiquette : lecture du tableau nutritionnel d'un emballage
const LABEL_PROMPT = `Tu lis l'étiquette nutritionnelle d'un emballage alimentaire photographié.
Recopie les valeurs EXACTEMENT comme elles sont imprimées, sans les estimer :
- "is_label" : true si un tableau de valeurs nutritionnelles est lisible, sinon false ;
- "product_name" : le nom du produit s'il est visible (ex: "Pizza 4 fromages"), sinon "" ;
- "basis_grams" : la quantité de la colonne lue, 100 pour "pour 100 g" (prends la colonne pour 100 g / 100 ml si elle existe) ;
- "kcal" : l'énergie en kcal (PAS en kJ) ;
- "protein", "carbs", "fat" : protéines, glucides (total, pas "dont sucres"), lipides (total, pas "dont acides gras saturés"), en grammes ;
- "portion_grams" : le poids d'une portion s'il est indiqué, sinon 0 ;
- "package_grams" : le poids net du paquet s'il est indiqué (ex: "Poids net : 390 g"), sinon 0.`

const LABEL_SCHEMA = {
  type: 'object',
  properties: {
    is_label: { type: 'boolean' },
    product_name: { type: 'string' },
    basis_grams: { type: 'number' },
    kcal: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    portion_grams: { type: 'number' },
    package_grams: { type: 'number' },
  },
  required: ['is_label', 'product_name', 'basis_grams', 'kcal', 'protein', 'carbs', 'fat', 'portion_grams', 'package_grams'],
  additionalProperties: false,
}

const round1 = (n: number) => Math.round(n * 10) / 10

function toLabelFood(raw: any): ScannedFood | null {
  if (!raw?.is_label) return null
  // Ramène à 100 g si le modèle a lu la colonne "par portion"
  const basis = Number(raw.basis_grams) > 0 ? clamp(raw.basis_grams, 1, 2000) : 100
  const factor = 100 / basis
  const protein = clamp(raw.protein, 0, 100 * basis) * factor
  const carbs = clamp(raw.carbs, 0, 100 * basis) * factor
  const fat = clamp(raw.fat, 0, 100 * basis) * factor
  let calories = clamp(raw.kcal, 0, 10000) * factor
  const fromMacros = protein * 4 + carbs * 4 + fat * 9
  // kJ lus à la place des kcal (1 kcal = 4,184 kJ), ou énergie illisible : on se fie aux macros
  if (fromMacros > 0 && calories > fromMacros * 2) calories = calories / 4.184
  if (calories === 0 || calories > 900) calories = fromMacros

  const portion = Math.round(clamp(raw.portion_grams, 0, 5000))
  const pack = Math.round(clamp(raw.package_grams, 0, 10000))
  const name = typeof raw.product_name === 'string' && raw.product_name.trim() ? raw.product_name.trim() : 'Produit scanné'
  return {
    name,
    // Quantité mangée : la portion indiquée si elle existe, sinon à saisir
    grams: portion,
    per100: { calories: Math.round(calories), protein: round1(protein), carbs: round1(carbs), fat: round1(fat) },
    source: 'label',
    ...(portion ? { portionGrams: portion } : {}),
    ...(pack ? { packageGrams: pack } : {}),
  }
}

const clamp = (value: unknown, min: number, max: number) => {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function toScannedFood(raw: any): ScannedFood | null {
  const name = typeof raw?.name === 'string' ? raw.name.trim() : ''
  if (!name) return null
  const reference = findReference(name, raw.reference)
  const count = clamp(raw.count, 0, 50)

  // Pour un aliment qui se compte, le nombre de pièces × poids unitaire est plus fiable que les grammes estimés
  const grams = Math.round(
    reference?.unitWeight && count > 0 ? count * reference.unitWeight : clamp(raw.grams, 1, 2000)
  )

  if (reference) {
    return {
      name: reference.name,
      grams,
      per100: { calories: reference.calories, protein: reference.protein, carbs: reference.carbs, fat: reference.fat },
      source: 'reference',
      ...(reference.unitWeight ? { unitWeight: reference.unitWeight, unitLabel: reference.unitLabel } : {}),
    }
  }
  return {
    name,
    grams,
    per100: {
      calories: clamp(raw.calories_per_100g, 0, 900),
      protein: clamp(raw.protein_per_100g, 0, 100),
      carbs: clamp(raw.carbs_per_100g, 0, 100),
      fat: clamp(raw.fat_per_100g, 0, 100),
    },
    source: 'estimate',
  }
}

const ERROR_STATUS: Record<AiError['code'], number> = {
  not_configured: 503,
  model_missing: 503,
  auth: 503,
  unavailable: 503,
  rate_limit: 429,
  timeout: 504,
  refusal: 422,
  invalid_output: 502,
}

function errorResponse(error: unknown) {
  if (error instanceof AiError) {
    return NextResponse.json({ error: error.message }, { status: ERROR_STATUS[error.code] })
  }
  return NextResponse.json({ error: "Impossible d'analyser la photo" }, { status: 500 })
}

// GET : prépare le modèle de vision (appelé à l'ouverture de l'appareil photo ; utile pour Ollama)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await warmUpVision()
    return NextResponse.json({ ready: true })
  } catch (error) {
    console.error('Error preloading vision model:', error)
    return errorResponse(error)
  }
}

// POST { image: base64 ou data URL } -> { foods: ScannedFood[] }
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let image: string
  let mode: 'plate' | 'label'
  try {
    const body = await request.json()
    image = typeof body?.image === 'string' ? body.image.replace(/^data:image\/[\w+.-]+;base64,/, '') : ''
    mode = body?.mode === 'label' ? 'label' : 'plate'
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }
  if (!image) {
    return NextResponse.json({ error: 'Image manquante' }, { status: 400 })
  }
  if (image.length > MAX_IMAGE_BASE64_LENGTH) {
    return NextResponse.json({ error: 'Image trop lourde' }, { status: 413 })
  }
  if (!takeAiQuota(session.user.id || session.user.email)) {
    return NextResponse.json({ error: AI_QUOTA_MESSAGE }, { status: 429 })
  }

  try {
    const isLabel = mode === 'label'
    const parsed = await generateJSON<any>({
      system: isLabel ? LABEL_PROMPT : SYSTEM_PROMPT,
      prompt: isLabel ? "Lis l'étiquette nutritionnelle." : 'Analyse ce repas.',
      images: [{ data: image }],
      schema: isLabel ? LABEL_SCHEMA : RESPONSE_SCHEMA,
      timeoutMs: SCAN_TIMEOUT_MS,
    })

    if (isLabel) {
      const food = toLabelFood(parsed)
      return NextResponse.json({ foods: food ? [food] : [] })
    }

    const foods = (Array.isArray(parsed?.foods) ? parsed.foods : [])
      .map(toScannedFood)
      .filter((f: ScannedFood | null): f is ScannedFood => f !== null)

    return NextResponse.json({ foods })
  } catch (error) {
    console.error('Error scanning meal photo:', error)
    return errorResponse(error)
  }
}
