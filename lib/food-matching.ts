// Association d'un aliment nommé (ex: par le scan photo) à une entrée de la base d'ingrédients.
// Sans dépendance pour pouvoir être testé isolément.
import type { IngredientSeed } from "./data/ingredients-seed"

// Mots significatifs d'un nom, sans accents ni pluriel ("Œufs au plat" -> oeuf, plat)
const STOPWORDS = new Set(["de", "du", "des", "au", "aux", "a", "la", "le", "les", "l", "d", "en", "et", "avec", "sans", "type", "un", "une"])

export function nameTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/œ/g, "oe")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9%]+/)
      .filter((w) => w && !STOPWORDS.has(w))
      .map((w) => (w.length > 3 ? w.replace(/[sx]$/, "") : w))
  )
}

function similarity(a: Set<string>, b: Set<string>): number {
  let common = 0
  a.forEach((w) => { if (b.has(w)) common++ })
  return common / (a.size + b.size - common || 1)
}

// Mots d'état de cuisson : exclus de la comparaison, ils servent seulement à départager
const RAW_WORDS = new Set(["cru", "crue"])
const SERVED_WORDS = new Set(["cuit", "cuite", "grille", "grillee", "roti", "rotie", "saute", "sautee", "friteuse", "prepare", "preparee"])
type State = "raw" | "served" | "neutral"

function split(name: string): { core: Set<string>; state: State } {
  const core = new Set<string>()
  let state: State = "neutral"
  nameTokens(name).forEach((w) => {
    if (RAW_WORDS.has(w)) state = "raw"
    else if (SERVED_WORDS.has(w)) state = state === "raw" ? "raw" : "served"
    else core.add(w)
  })
  return { core, state }
}

const STATE_BONUS = 0.15
const SUGGESTION_BONUS = 0.1
const MIN_SCORE = 0.6

// Recherche : tous les mots tapés doivent commencer un mot du nom. Les mots exacts passent
// en premier, puis les versions cuites (on cherche ce qu'il y a dans l'assiette), les crues en dernier
export function searchFoods(items: IngredientSeed[], query: string, limit = 8): IngredientSeed[] {
  const words = [...nameTokens(query)]
  if (words.length === 0) return []
  const stateRank: Record<State, number> = { served: 0, neutral: 1, raw: 2 }
  return items
    .map((item) => {
      const tokens = [...nameTokens(item.name)]
      const matches = words.every((w) => tokens.some((t) => t.startsWith(w)))
      const exact = words.filter((w) => tokens.includes(w)).length
      return { item, matches, exact, state: split(item.name).state }
    })
    .filter((r) => r.matches)
    .sort((a, b) => b.exact - a.exact || stateRank[a.state] - stateRank[b.state])
    .slice(0, limit)
    .map((r) => r.item)
}

export function createFoodMatcher(items: IngredientSeed[]) {
  const references = items.map((item) => ({ item, ...split(item.name) }))

  // On compare d'abord le nom de l'aliment (plus fiable que le choix d'un petit modèle dans une
  // longue liste) ; la référence suggérée ne sert qu'à départager
  return function findReference(name: string, suggested?: unknown): IngredientSeed | undefined {
    const target = split(name)
    if (target.core.size === 0) return undefined
    // Une photo montre des aliments prêts à manger : on préfère la version cuite, sauf si le nom dit "cru"
    const wanted: State = target.state === "raw" ? "raw" : "served"
    const suggestion = typeof suggested === "string" ? suggested.trim().toLowerCase() : ""

    let best: { item: IngredientSeed; score: number } | undefined
    for (const ref of references) {
      let score = similarity(target.core, ref.core)
      if (ref.state === wanted) score += STATE_BONUS
      else if (ref.state !== "neutral") score -= STATE_BONUS
      if (suggestion && ref.item.name.toLowerCase() === suggestion) score += SUGGESTION_BONUS
      if (!best || score > best.score) best = { item: ref.item, score }
    }
    return best && best.score >= MIN_SCORE ? best.item : undefined
  }
}
