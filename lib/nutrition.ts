import type { FitnessProfile, Recipe } from "@/lib/types"

export interface MacroValues {
  calories: number
  protein: number
  carbs: number
  fats: number
}

export const goalLabels = {
  weight_loss: "Perte de poids",
  muscle_gain: "Prise de masse",
  maintenance: "Maintenance",
}

// Calculer les macros recommandées basé sur le profil
export function calculateMacros(profile: FitnessProfile): MacroValues {
  // Calcul du métabolisme de base (Mifflin-St Jeor)
  let bmr
  if (profile.gender === "male") {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
  } else {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161
  }

  // Facteur d'activité
  const activityFactors = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  }

  let calories = bmr * activityFactors[profile.activityLevel]

  // Ajustement selon l'objectif
  if (profile.goal === "weight_loss") {
    calories -= 500 // Déficit de 500 cal pour perdre ~0.5kg/semaine
  } else if (profile.goal === "muscle_gain") {
    calories += 300 // Surplus de 300 cal pour prise de masse
  }

  // Répartition des macros
  const protein = profile.goal === "muscle_gain" ? profile.weight * 2.2 : profile.weight * 1.8
  const fats = calories * 0.25 / 9 // 25% des calories en lipides
  const carbs = (calories - (protein * 4) - (fats * 9)) / 4

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fats: Math.round(fats),
  }
}

// Objectifs effectifs : valeurs personnalisées si définies, sinon la recommandation calculée
export function getEffectiveMacros(profile: FitnessProfile | null | undefined): MacroValues | null {
  if (!profile) return null
  const recommended = calculateMacros(profile)
  return {
    calories: profile.customCalories ?? recommended.calories,
    protein: profile.customProtein ?? recommended.protein,
    carbs: profile.customCarbs ?? recommended.carbs,
    fats: profile.customFats ?? recommended.fats,
  }
}

export function hasCustomMacros(profile: FitnessProfile | null | undefined): boolean {
  return !!(
    profile?.customCalories ??
    profile?.customProtein ??
    profile?.customCarbs ??
    profile?.customFats
  )
}

// Les macros d'une recette Cuisine portent sur toute la recette : on les ramène à une portion
export function recipeMacrosPerServing(recipe: Recipe): MacroValues | null {
  if (recipe.calories == null && recipe.protein == null && recipe.carbs == null && recipe.fat == null) {
    return null
  }
  const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1
  return {
    calories: (recipe.calories || 0) / servings,
    protein: (recipe.protein || 0) / servings,
    carbs: (recipe.carbs || 0) / servings,
    fats: (recipe.fat || 0) / servings,
  }
}

// Aliment identifié sur une photo de plat (macros pour 100 g, poids estimé modifiable)
export interface ScannedFood {
  name: string
  grams: number
  per100: { calories: number; protein: number; carbs: number; fat: number }
  // "reference" = base d'ingrédients, "estimate" = estimation du modèle, "label" = lu sur l'étiquette
  source: "reference" | "estimate" | "label"
  // Poids d'une pièce, pour afficher "≈ 2 œufs" à côté des grammes
  unitWeight?: number
  unitLabel?: string
  // Étiquette : poids d'une portion et poids net du paquet, s'ils sont imprimés
  portionGrams?: number
  packageGrams?: number
}

export function scannedFoodsTotal(foods: ScannedFood[]): MacroValues {
  const total = foods.reduce(
    (acc, f) => ({
      calories: acc.calories + (f.per100.calories * f.grams) / 100,
      protein: acc.protein + (f.per100.protein * f.grams) / 100,
      carbs: acc.carbs + (f.per100.carbs * f.grams) / 100,
      fats: acc.fats + (f.per100.fat * f.grams) / 100,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  )
  return scaleMacros(total, 1)
}

export function scaleMacros(macros: MacroValues, factor: number): MacroValues {
  const round1 = (n: number) => Math.round(n * 10) / 10
  return {
    calories: Math.round(macros.calories * factor),
    protein: round1(macros.protein * factor),
    carbs: round1(macros.carbs * factor),
    fats: round1(macros.fats * factor),
  }
}
