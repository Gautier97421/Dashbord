"use client"

import { useState, useEffect, useRef } from "react"
import { useApp } from "@/lib/store-api"
import { generateId, getToday } from "@/lib/helpers"
import { goalLabels, getEffectiveMacros, hasCustomMacros as hasCustomMacrosFor, recipeMacrosPerServing, scaleMacros, scannedFoodsTotal, type ScannedFood } from "@/lib/nutrition"
import { ingredientsSeed, type IngredientSeed } from "@/lib/data/ingredients-seed"
import { searchFoods } from "@/lib/food-matching"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Trash2, Search, ChefHat, X, Camera, Loader2, UtensilsCrossed, ScanText } from "lucide-react"
import type { Meal, MealPreset, Recipe } from "@/lib/types"
import { Lottie } from "@/components/lottie"

const EMPTY_MEAL: Partial<Meal> = { name: "", time: "12:00", calories: 0, protein: 0, carbs: 0, fats: 0 }
const SCANNED_MEAL_NAME = "Plat scanné"
const SCAN_MAX_SIZE = 1024 // px, côté le plus long envoyé au modèle

const currentTime = () => new Date().toTimeString().slice(0, 5)

// Réduit la photo avant l'envoi (les photos de téléphone font plusieurs Mo)
async function resizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("Image illisible"))
      el.src = url
    })
    const scale = Math.min(1, SCAN_MAX_SIZE / Math.max(img.width, img.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function NutritionPage() {
  const {
    state,
    updateFitnessProfile,
    addMeal: persistAddMeal,
    updateMeal: persistUpdateMeal,
    deleteMeal: persistDeleteMeal,
  } = useApp()
  const [showMealForm, setShowMealForm] = useState(false)
  const [mealFormTab, setMealFormTab] = useState<"dish" | "recipe">("dish")
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)
  const [newMeal, setNewMeal] = useState<Partial<Meal>>(EMPTY_MEAL)
  const [linkedRecipe, setLinkedRecipe] = useState<Recipe | null>(null)
  const [portions, setPortions] = useState(1)
  const [recipeSearch, setRecipeSearch] = useState("")
  const [showMacroGoalsForm, setShowMacroGoalsForm] = useState(false)
  const [macroGoalsDraft, setMacroGoalsDraft] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 })
  const [nutritionView, setNutritionView] = useState<"today" | "history">("today")
  const [nutritionMonth, setNutritionMonth] = useState(getToday().slice(0, 7)) // YYYY-MM
  const [showPresetForm, setShowPresetForm] = useState(false)
  const [editingPreset, setEditingPreset] = useState<MealPreset | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)
  // "plate" = photo d'une assiette, "label" = étiquette nutritionnelle d'un emballage
  const [scanMode, setScanMode] = useState<"plate" | "label">("plate")
  const scanModeRef = useRef<"plate" | "label">("plate")
  const [showScan, setShowScan] = useState(false)
  const [scanStatus, setScanStatus] = useState<"loading" | "done" | "error">("loading")
  const [scanError, setScanError] = useState("")
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scannedFoods, setScannedFoods] = useState<ScannedFood[]>([])
  const [scanTime, setScanTime] = useState("12:00")
  // Recherche dans la base d'ingrédients pendant un scan : ajout d'un aliment ou remplacement d'un aliment mal reconnu
  const [foodSearch, setFoodSearch] = useState<{ mode: "add" } | { mode: "replace"; index: number } | null>(null)
  const [foodQuery, setFoodQuery] = useState("")

  // Meal presets stockés localement (pourrait être persisté plus tard)
  const [mealPresets, setMealPresets] = useState<MealPreset[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mealPresets')
      if (saved) return JSON.parse(saved)
    }
    return [
      { id: "1", name: "Petit-déj", category: "breakfast", calories: 450, protein: 20, carbs: 50, fats: 18 },
      { id: "2", name: "Déjeuner", category: "lunch", calories: 600, protein: 35, carbs: 55, fats: 22 },
      { id: "3", name: "Dîner", category: "dinner", calories: 500, protein: 30, carbs: 40, fats: 20 },
    ]
  })

  const [newPreset, setNewPreset] = useState<Partial<MealPreset>>({
    name: "",
    category: "breakfast",
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  })

  // Sauvegarder les presets dans localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mealPresets', JSON.stringify(mealPresets))
    }
  }, [mealPresets])

  const effectiveMacros = getEffectiveMacros(state.fitnessProfile)
  const hasCustomMacros = hasCustomMacrosFor(state.fitnessProfile)

  // Nutrition du jour
  const todayNutrition = state.dailyNutrition.find((n) => n.date === getToday())

  const openMacroGoalsForm = () => {
    if (!effectiveMacros) return
    setMacroGoalsDraft(effectiveMacros)
    setShowMacroGoalsForm(true)
  }

  const saveMacroGoals = async () => {
    if (!state.fitnessProfile) return
    try {
      await updateFitnessProfile({
        ...state.fitnessProfile,
        customCalories: macroGoalsDraft.calories,
        customProtein: macroGoalsDraft.protein,
        customCarbs: macroGoalsDraft.carbs,
        customFats: macroGoalsDraft.fats,
      })
      setShowMacroGoalsForm(false)
    } catch (error) {
      console.error('Error saving macro goals:', error)
    }
  }

  const resetMacroGoals = async () => {
    if (!state.fitnessProfile) return
    try {
      await updateFitnessProfile({
        ...state.fitnessProfile,
        customCalories: null,
        customProtein: null,
        customCarbs: null,
        customFats: null,
      })
      setShowMacroGoalsForm(false)
    } catch (error) {
      console.error('Error resetting macro goals:', error)
    }
  }

  // Ouvre le formulaire de repas ; sans valeurs initiales, on démarre sur un plat vide à l'heure actuelle
  const openMealForm = (initial: Partial<Meal> = { ...EMPTY_MEAL, time: currentTime() }) => {
    setEditingMeal(null)
    setLinkedRecipe(null)
    setPortions(1)
    setRecipeSearch("")
    setNewMeal(initial)
    setMealFormTab("dish")
    setShowMealForm(true)
  }

  const closeMealForm = () => {
    setShowMealForm(false)
    setEditingMeal(null)
    setLinkedRecipe(null)
    setNewMeal(EMPTY_MEAL)
  }

  const saveMeal = async () => {
    if (!newMeal.name) return

    const meal = {
      name: newMeal.name!,
      time: newMeal.time || "12:00",
      calories: newMeal.calories || 0,
      protein: newMeal.protein || 0,
      carbs: newMeal.carbs || 0,
      fats: newMeal.fats || 0,
      recipeId: linkedRecipe?.id ?? null,
    }

    try {
      if (editingMeal) {
        await persistUpdateMeal({ id: editingMeal.id, ...meal })
      } else {
        await persistAddMeal(getToday(), meal)
      }
    } catch (error) {
      console.error('Error saving meal:', error)
    }

    closeMealForm()
  }

  const startEditMeal = (meal: Meal) => {
    const recipe = meal.recipeId ? state.recipes.find((r) => r.id === meal.recipeId) ?? null : null
    const perServing = recipe ? recipeMacrosPerServing(recipe) : null
    setEditingMeal(meal)
    setLinkedRecipe(recipe)
    // Retrouve le nombre de portions à partir des calories enregistrées
    setPortions(perServing && perServing.calories > 0 ? Math.round((meal.calories / perServing.calories) * 100) / 100 : 1)
    setNewMeal({
      name: meal.name,
      time: meal.time,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fats: meal.fats,
    })
    setMealFormTab("dish")
    setShowMealForm(true)
  }

  const deleteMeal = async (mealId: string) => {
    try {
      await persistDeleteMeal(mealId)
    } catch (error) {
      console.error('Error deleting meal:', error)
    }
  }

  // Choisir une recette de la Cuisine : préremplit le plat (toujours modifiable)
  const selectRecipe = (recipe: Recipe) => {
    const perServing = recipeMacrosPerServing(recipe)
    setLinkedRecipe(recipe)
    setPortions(1)
    setNewMeal({
      ...newMeal,
      name: recipe.name,
      ...(perServing ? scaleMacros(perServing, 1) : { calories: 0, protein: 0, carbs: 0, fats: 0 }),
    })
    setMealFormTab("dish")
  }

  const changePortions = (value: number) => {
    setPortions(value)
    const perServing = linkedRecipe ? recipeMacrosPerServing(linkedRecipe) : null
    if (perServing && value > 0) {
      setNewMeal({ ...newMeal, ...scaleMacros(perServing, value) })
    }
  }

  // Scan d'un plat en photo : identification des aliments puis calcul des macros
  const handleScanFile = async (file: File | undefined) => {
    if (!file) return
    setShowScan(true)
    setScanStatus("loading")
    setScanError("")
    setScannedFoods([])
    setFoodSearch(null)
    setScanTime(currentTime())
    try {
      const image = await resizeImage(file)
      setScanPreview(image)
      const res = await fetch("/api/nutrition/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mode: scanModeRef.current }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Impossible d'analyser la photo")
      setScannedFoods(data.foods || [])
      setScanStatus("done")
    } catch (error: any) {
      setScanError(error.message || "Impossible d'analyser la photo")
      setScanStatus("error")
    }
  }

  const openScanCamera = (mode: "plate" | "label" = scanModeRef.current) => {
    scanModeRef.current = mode
    setScanMode(mode)
    // Précharge le modèle pendant que la photo est prise (le chargement est l'étape la plus lente)
    fetch("/api/nutrition/scan").catch(() => {})
    if (scanInputRef.current) scanInputRef.current.value = ""
    scanInputRef.current?.click()
  }

  const closeScan = () => {
    setShowScan(false)
    setScanPreview(null)
    setScannedFoods([])
    setFoodSearch(null)
    if (scanInputRef.current) scanInputRef.current.value = ""
  }

  const openFoodSearch = (search: { mode: "add" } | { mode: "replace"; index: number }) => {
    setFoodQuery("")
    setFoodSearch(search)
  }

  const pickFood = (item: IngredientSeed) => {
    const food: ScannedFood = {
      name: item.name,
      grams: item.unitWeight || 100,
      per100: { calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat },
      source: "reference",
      ...(item.unitWeight ? { unitWeight: item.unitWeight, unitLabel: item.unitLabel } : {}),
    }
    if (foodSearch?.mode === "replace") {
      // On garde la quantité estimée, seul l'aliment change
      setScannedFoods(scannedFoods.map((f, i) => (i === foodSearch.index ? { ...food, grams: f.grams } : f)))
    } else {
      setScannedFoods([...scannedFoods, food])
    }
    setFoodSearch(null)
  }

  const foodResults = foodSearch ? searchFoods(ingredientsSeed, foodQuery) : []

  // "≈ 2 œufs" pour les aliments qui se comptent
  const piecesLabel = (food: ScannedFood) => {
    if (!food.unitWeight || !food.unitLabel) return null
    const count = Math.round((food.grams / food.unitWeight) * 2) / 2
    return `≈ ${count} ${food.unitLabel}${count > 1 && !/[sx]$/.test(food.unitLabel) ? "s" : ""}`
  }

  const updateScannedGrams = (index: number, grams: number) => {
    setScannedFoods(scannedFoods.map((f, i) => (i === index ? { ...f, grams } : f)))
  }

  const removeScannedFood = (index: number) => {
    setScannedFoods(scannedFoods.filter((_, i) => i !== index))
    setFoodSearch(null)
  }

  const scannedTotal = scannedFoodsTotal(scannedFoods)
  // Un produit seul lu sur son étiquette garde son nom (ex: "Pizza Royale"), sinon "Plat scanné"
  const scannedMealName =
    scannedFoods.length === 1 && scannedFoods[0].source === "label" ? scannedFoods[0].name : SCANNED_MEAL_NAME
  const missingGrams = scannedFoods.some((f) => !f.grams || f.grams <= 0)

  const saveScannedMeal = async () => {
    if (scannedFoods.length === 0 || missingGrams) return
    try {
      await persistAddMeal(getToday(), {
        name: scannedMealName,
        time: scanTime || currentTime(),
        ...scannedTotal,
        recipeId: null,
      })
    } catch (error) {
      console.error('Error saving scanned meal:', error)
    }
    closeScan()
  }

  const filteredRecipes = state.recipes
    .filter((r) => r.name.toLowerCase().includes(recipeSearch.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Gestion des presets
  const savePreset = () => {
    if (!newPreset.name) return

    const preset: MealPreset = {
      id: editingPreset?.id || generateId(),
      name: newPreset.name!,
      category: newPreset.category as "breakfast" | "lunch" | "snack" | "dinner",
      calories: newPreset.calories || 0,
      protein: newPreset.protein || 0,
      carbs: newPreset.carbs || 0,
      fats: newPreset.fats || 0,
    }

    if (editingPreset) {
      setMealPresets(mealPresets.map(p => p.id === preset.id ? preset : p))
    } else {
      setMealPresets([...mealPresets, preset])
    }

    setShowPresetForm(false)
    setEditingPreset(null)
    setNewPreset({ name: "", category: "breakfast", calories: 0, protein: 0, carbs: 0, fats: 0 })
  }

  const deletePreset = (presetId: string) => {
    setMealPresets(mealPresets.filter(p => p.id !== presetId))
  }

  const applyPreset = (preset: MealPreset) => {
    const timeMap = {
      breakfast: "08:00",
      lunch: "12:30",
      snack: "16:00",
      dinner: "19:30",
    }
    openMealForm({
      name: preset.name,
      time: timeMap[preset.category],
      calories: preset.calories,
      protein: preset.protein,
      carbs: preset.carbs,
      fats: preset.fats,
    })
  }

  // Calcul des stats mensuelles
  const getMonthlyNutritionStats = () => {
    const [year, month] = nutritionMonth.split("-").map(Number)
    const monthData = state.dailyNutrition.filter(n => {
      const [nYear, nMonth] = n.date.split("-").map(Number)
      return nYear === year && nMonth === month
    })

    if (monthData.length === 0) return null

    const totalCalories = monthData.reduce((sum, d) => sum + d.calories, 0)
    const totalProtein = monthData.reduce((sum, d) => sum + d.protein, 0)
    const totalCarbs = monthData.reduce((sum, d) => sum + d.carbs, 0)
    const totalFats = monthData.reduce((sum, d) => sum + d.fats, 0)

    return {
      daysTracked: monthData.length,
      avgCalories: Math.round(totalCalories / monthData.length),
      avgProtein: Math.round(totalProtein / monthData.length),
      avgCarbs: Math.round(totalCarbs / monthData.length),
      avgFats: Math.round(totalFats / monthData.length),
      totalCalories,
      dailyData: monthData.sort((a, b) => a.date.localeCompare(b.date)),
    }
  }

  const monthlyStats = getMonthlyNutritionStats()

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Nutrition</h1>
        <p className="text-sm text-muted-foreground">Suivez votre alimentation et vos objectifs</p>
      </div>

      {effectiveMacros ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Objectifs nutritionnels du jour</CardTitle>
                <CardDescription>
                  {hasCustomMacros ? "Objectifs personnalisés" : `Basé sur votre profil (${goalLabels[state.fitnessProfile!.goal]})`}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={openMacroGoalsForm}>
                Modifier
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center py-4 px-1 rounded-lg border">
                <p className="text-sm sm:text-2xl font-bold">{effectiveMacros.calories}kcal</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Calories</p>
                {todayNutrition && (
                  <p className="text-xs mt-1">{todayNutrition.calories}/{effectiveMacros.calories}</p>
                )}
              </div>
              <div className="text-center py-4 px-1 rounded-lg border">
                <p className="text-sm sm:text-2xl font-bold">{effectiveMacros.protein}g</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Protéines</p>
                {todayNutrition && (
                  <p className="text-xs mt-1">{todayNutrition.protein}g/{effectiveMacros.protein}g</p>
                )}
              </div>
              <div className="text-center py-4 px-1 rounded-lg border">
                <p className="text-sm sm:text-2xl font-bold">{effectiveMacros.carbs}g</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Glucides</p>
                {todayNutrition && (
                  <p className="text-xs mt-1">{todayNutrition.carbs}g/{effectiveMacros.carbs}g</p>
                )}
              </div>
              <div className="text-center py-4 px-1 rounded-lg border">
                <p className="text-sm sm:text-2xl font-bold">{effectiveMacros.fats}g</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Lipides</p>
                {todayNutrition && (
                  <p className="text-xs mt-1">{todayNutrition.fats}g/{effectiveMacros.fats}g</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Renseignez votre profil dans <span className="font-medium text-foreground">Sport → Profil</span> pour calculer vos objectifs nutritionnels.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Repas</CardTitle>
              <CardDescription>Suivi de votre alimentation</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={nutritionView === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setNutritionView("today")}
              >
                Aujourd'hui
              </Button>
              <Button
                variant={nutritionView === "history" ? "default" : "outline"}
                size="sm"
                onClick={() => setNutritionView("history")}
              >
                Historique
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {nutritionView === "today" ? (
            <>
              {/* Presets personnalisables */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Saisie rapide</h4>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setNewPreset({ name: "", category: "breakfast", calories: 0, protein: 0, carbs: 0, fats: 0 })
                    setEditingPreset(null)
                    setShowPresetForm(!showPresetForm)
                  }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter preset
                  </Button>
                </div>

                {showPresetForm && (
                  <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                    <h4 className="font-semibold">{editingPreset ? "Modifier le preset" : "Nouveau preset"}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nom</Label>
                        <Input
                          placeholder="Ex: Omelette, Salade César..."
                          value={newPreset.name}
                          onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Catégorie</Label>
                        <Select
                          value={newPreset.category}
                          onValueChange={(v) => setNewPreset({ ...newPreset, category: v as any })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="breakfast">🥐 Petit-déjeuner</SelectItem>
                            <SelectItem value="lunch">🍽️ Déjeuner</SelectItem>
                            <SelectItem value="snack">🍎 Collation</SelectItem>
                            <SelectItem value="dinner">🍖 Dîner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <Label>Calories</Label>
                        <Input type="number" value={newPreset.calories} onChange={(e) => setNewPreset({ ...newPreset, calories: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label>Protéines (g)</Label>
                        <Input type="number" value={newPreset.protein} onChange={(e) => setNewPreset({ ...newPreset, protein: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label>Glucides (g)</Label>
                        <Input type="number" value={newPreset.carbs} onChange={(e) => setNewPreset({ ...newPreset, carbs: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label>Lipides (g)</Label>
                        <Input type="number" value={newPreset.fats} onChange={(e) => setNewPreset({ ...newPreset, fats: parseInt(e.target.value) || 0 })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={savePreset}>{editingPreset ? "Enregistrer" : "Créer"}</Button>
                      <Button variant="outline" onClick={() => { setShowPresetForm(false); setEditingPreset(null) }}>Annuler</Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {mealPresets.map((preset) => (
                    <div key={preset.id} className="group relative">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset(preset)}
                      >
                        {preset.category === "breakfast" ? "🥐" : preset.category === "lunch" ? "🍽️" : preset.category === "snack" ? "🍎" : "🍖"} {preset.name}
                      </Button>
                      <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1">
                        <button
                          className="p-1 rounded-full bg-muted border text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            setNewPreset(preset)
                            setEditingPreset(preset)
                            setShowPresetForm(true)
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          className="p-1 rounded-full bg-destructive/10 border border-destructive/20 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            deletePreset(preset.id)
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {mealPresets.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucun preset. Créez-en un pour la saisie rapide.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="font-medium">Repas du jour</h4>
                <div className="flex gap-2">
                  <input
                    ref={scanInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleScanFile(e.target.files?.[0])}
                  />
                  <DropdownMenu>
                    {/* Le bouton est l'animation elle-même (comme la corbeille) : elle se joue au survol */}
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Scanner"
                        title="Scanner"
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {/* Le cadre du scan occupe 45 % de l'animation : agrandi pour faire exactement la taille du bouton + voisin */}
                        <Lottie src="/animations/utilisees/Scan.json" mode="hover" adaptive="all" zoom={2.2} className="size-9" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openScanCamera("plate")}>
                        <UtensilsCrossed className="h-4 w-4 mr-2" />
                        Photo du plat
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openScanCamera("label")}>
                        <ScanText className="h-4 w-4 mr-2" />
                        Étiquette nutritionnelle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    data-tour="nutrition-add"
                    size="icon"
                    onClick={() => openMealForm()}
                    aria-label="Ajouter un repas"
                    title="Ajouter un repas"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {todayNutrition?.meals
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((meal) => (
                    <div
                      key={meal.id}
                      className="flex items-center justify-between gap-2 p-4 rounded-lg border bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold flex items-center gap-1.5">
                              {meal.recipeId && <ChefHat className="h-4 w-4 shrink-0 text-muted-foreground" />}
                              <span className="truncate">{meal.name}</span>
                            </p>
                            <p className="text-sm text-muted-foreground">{meal.time}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm">
                            <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-600">
                              {meal.calories} cal
                            </span>
                            <span className="px-2 py-1 rounded bg-green-500/10 text-green-600">
                              P: {meal.protein}g
                            </span>
                            <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-600">
                              C: {meal.carbs}g
                            </span>
                            <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-600">
                              L: {meal.fats}g
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditMeal(meal)}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMeal(meal.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                {!todayNutrition || todayNutrition.meals.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-center text-muted-foreground">
                    <Lottie src="/animations/utilisees/Walking Avocado.json" adaptive="ink" className="size-32 text-foreground" />
                    <p>Aucun repas enregistré aujourd'hui</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            /* Vue Historique Mensuel */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Historique mensuel</h4>
                <Input
                  type="month"
                  value={nutritionMonth}
                  onChange={(e) => setNutritionMonth(e.target.value)}
                  className="w-auto"
                />
              </div>

              {monthlyStats ? (
                <>
                  {/* Stats du mois */}
                  <div className="grid grid-cols-2 @2xl/main:grid-cols-5 gap-4">
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold text-primary">{monthlyStats.daysTracked}</p>
                      <p className="text-sm text-muted-foreground">Jours suivis</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold">{monthlyStats.avgCalories}</p>
                      <p className="text-sm text-muted-foreground">Cal/jour moy.</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold text-green-600">{monthlyStats.avgProtein}g</p>
                      <p className="text-sm text-muted-foreground">Protéines/jour</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold text-yellow-600">{monthlyStats.avgCarbs}g</p>
                      <p className="text-sm text-muted-foreground">Glucides/jour</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold text-orange-600">{monthlyStats.avgFats}g</p>
                      <p className="text-sm text-muted-foreground">Lipides/jour</p>
                    </div>
                  </div>

                  {/* Comparaison avec objectifs */}
                  {effectiveMacros && (
                    <div className="p-4 rounded-lg border bg-muted/50">
                      <h5 className="font-medium mb-3">Comparaison avec vos objectifs</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Calories</span>
                            <span className={monthlyStats.avgCalories >= effectiveMacros.calories * 0.9 && monthlyStats.avgCalories <= effectiveMacros.calories * 1.1 ? "text-green-600" : "text-orange-600"}>
                              {Math.round((monthlyStats.avgCalories / effectiveMacros.calories) * 100)}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, (monthlyStats.avgCalories / effectiveMacros.calories) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Protéines</span>
                            <span className={monthlyStats.avgProtein >= effectiveMacros.protein * 0.9 ? "text-green-600" : "text-orange-600"}>
                              {Math.round((monthlyStats.avgProtein / effectiveMacros.protein) * 100)}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all"
                              style={{ width: `${Math.min(100, (monthlyStats.avgProtein / effectiveMacros.protein) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Glucides</span>
                            <span>{Math.round((monthlyStats.avgCarbs / effectiveMacros.carbs) * 100)}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-500 transition-all"
                              style={{ width: `${Math.min(100, (monthlyStats.avgCarbs / effectiveMacros.carbs) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Lipides</span>
                            <span>{Math.round((monthlyStats.avgFats / effectiveMacros.fats) * 100)}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 transition-all"
                              style={{ width: `${Math.min(100, (monthlyStats.avgFats / effectiveMacros.fats) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Liste des jours */}
                  <div className="space-y-2">
                    <h5 className="font-medium">Détail par jour</h5>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {monthlyStats.dailyData.map((day) => (
                        <div key={day.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border">
                          <div>
                            <p className="font-medium">
                              {new Date(day.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                            </p>
                            <p className="text-sm text-muted-foreground">{day.meals.length} repas</p>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:gap-3 text-sm">
                            <span className="px-2 py-1 rounded bg-primary/10">{day.calories} cal</span>
                            <span className="px-2 py-1 rounded bg-green-500/10 text-green-600">P: {day.protein}g</span>
                            <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-600">G: {day.carbs}g</span>
                            <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-600">L: {day.fats}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucune donnée de nutrition pour ce mois
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conseils nutritionnels */}
      <Card>
        <CardHeader>
          <CardTitle>Conseils nutritionnels</CardTitle>
          <CardDescription>Recommandations pour optimiser vos performances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Répartition des repas */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                Répartition des repas
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted border">
                  <p className="text-sm font-medium">Petit-déjeuner</p>
                  <p className="text-2xl font-bold">25%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted border">
                  <p className="text-sm font-medium">Déjeuner</p>
                  <p className="text-2xl font-bold">30%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted border">
                  <p className="text-sm font-medium">Collation</p>
                  <p className="text-2xl font-bold">15%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted border">
                  <p className="text-sm font-medium">Dîner</p>
                  <p className="text-2xl font-bold">30%</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog d'ajout / modification d'un repas : plat saisi à la main ou recette de la Cuisine */}
      <Dialog open={showMealForm} onOpenChange={(open) => { if (!open) closeMealForm() }}>
        <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMeal ? "Modifier le repas" : "Ajouter un repas"}</DialogTitle>
            <DialogDescription>
              Saisissez un plat ou reprenez une recette de la Cuisine avec ses macros.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={mealFormTab} onValueChange={(v) => setMealFormTab(v as "dish" | "recipe")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dish">Plat</TabsTrigger>
              <TabsTrigger value="recipe">
                <ChefHat className="h-4 w-4 mr-1" />
                Depuis Cuisine
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dish" className="space-y-4 pt-2">
              {linkedRecipe && (
                <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChefHat className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm truncate">
                      Recette : <span className="font-medium">{linkedRecipe.name}</span>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setLinkedRecipe(null)}
                    aria-label="Retirer le lien avec la recette"
                    title="Retirer le lien avec la recette"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Plat</Label>
                  <Input
                    placeholder="Ex: Pâtes bolognaise"
                    value={newMeal.name}
                    onChange={(e) => setNewMeal({ ...newMeal, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Heure</Label>
                  <Input
                    type="time"
                    value={newMeal.time}
                    onChange={(e) => setNewMeal({ ...newMeal, time: e.target.value })}
                  />
                </div>
              </div>

              {linkedRecipe && recipeMacrosPerServing(linkedRecipe) && (
                <div>
                  <Label>Portions mangées</Label>
                  <Input
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={portions}
                    onChange={(e) => changePortions(parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {linkedRecipe.servings && linkedRecipe.servings > 1
                      ? `La recette fait ${linkedRecipe.servings} portions : les macros sont calculées pour une portion.`
                      : "Les macros de la recette sont comptées pour une portion."}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <Label>Calories</Label>
                  <Input
                    type="number"
                    value={newMeal.calories}
                    onChange={(e) => setNewMeal({ ...newMeal, calories: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Protéines (g)</Label>
                  <Input
                    type="number"
                    value={newMeal.protein}
                    onChange={(e) => setNewMeal({ ...newMeal, protein: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Glucides (g)</Label>
                  <Input
                    type="number"
                    value={newMeal.carbs}
                    onChange={(e) => setNewMeal({ ...newMeal, carbs: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Lipides (g)</Label>
                  <Input
                    type="number"
                    value={newMeal.fats}
                    onChange={(e) => setNewMeal({ ...newMeal, fats: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recipe" className="space-y-3 pt-2">
              {state.recipes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Aucune recette dans la Cuisine pour l'instant.
                </p>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher une recette..."
                      value={recipeSearch}
                      onChange={(e) => setRecipeSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {filteredRecipes.map((recipe) => {
                      const perServing = recipeMacrosPerServing(recipe)
                      const shown = perServing ? scaleMacros(perServing, 1) : null
                      return (
                        <button
                          key={recipe.id}
                          type="button"
                          onClick={() => selectRecipe(recipe)}
                          className={`w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors ${linkedRecipe?.id === recipe.id ? "border-primary bg-muted/50" : ""}`}
                        >
                          <p className="font-medium">{recipe.name}</p>
                          {shown ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              {shown.calories} kcal · {shown.protein}g prot. · {shown.carbs}g gluc. · {shown.fats}g lip.
                              {recipe.servings && recipe.servings > 1 ? " / portion" : ""}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1">Macros non renseignées</p>
                          )}
                        </button>
                      )
                    })}
                    {filteredRecipes.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-6">Aucune recette trouvée</p>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeMealForm}>
              Annuler
            </Button>
            <Button onClick={saveMeal} disabled={!newMeal.name}>
              {editingMeal ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog du scan photo : aliments identifiés, poids modifiables, puis ajout en "Plat scanné" */}
      <Dialog open={showScan} onOpenChange={(open) => { if (!open) closeScan() }}>
        <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{scanMode === "label" ? "Scanner une étiquette" : "Scanner un plat"}</DialogTitle>
            <DialogDescription>
              Vérifiez les aliments reconnus et ajustez les quantités si besoin.
            </DialogDescription>
          </DialogHeader>

          {scanPreview && (
            <img src={scanPreview} alt="Photo du plat" className="w-full max-h-56 object-cover rounded-lg border" />
          )}

          {scanStatus === "loading" && (
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">{scanMode === "label" ? "Lecture de l'étiquette…" : "Analyse du plat en cours…"}</p>
            </div>
          )}

          {scanStatus === "error" && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-destructive">{scanError}</p>
              <Button variant="outline" onClick={() => openScanCamera()}>
                <Camera className="h-4 w-4 mr-2" />
                Reprendre une photo
              </Button>
            </div>
          )}

          {scanStatus === "done" && (
            <div className="space-y-4">
              {scannedFoods.length === 0 && (
                <div className="space-y-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    {scanMode === "label"
                      ? "Aucune étiquette nutritionnelle lisible. Prends le tableau bien à plat, net et sans reflet."
                      : "Aucun aliment reconnu sur cette photo."}
                  </p>
                  <Button variant="outline" onClick={() => openScanCamera()}>
                    <Camera className="h-4 w-4 mr-2" />
                    Reprendre une photo
                  </Button>
                </div>
              )}
              {scannedFoods.length > 0 && (
                <>
                  <div className="space-y-2">
                    {scannedFoods.map((food, index) => (
                      <div key={index} className="p-3 rounded-lg border space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            className="font-medium truncate max-w-full text-left hover:underline"
                            onClick={() => openFoodSearch({ mode: "replace", index })}
                            title="Changer d'aliment"
                          >
                            {food.name}
                          </button>
                          <p className="text-xs text-muted-foreground">
                            {Math.round((food.per100.calories * food.grams) / 100)} kcal
                            {piecesLabel(food) && ` · ${piecesLabel(food)}`}
                            {" · "}
                            {food.source === "reference" ? "base d'ingrédients" : food.source === "label" ? "étiquette" : "estimation"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            placeholder="?"
                            className={`w-20 ${!food.grams ? "border-amber-500 ring-1 ring-amber-500" : ""}`}
                            value={food.grams || ""}
                            onChange={(e) => updateScannedGrams(index, parseFloat(e.target.value) || 0)}
                            aria-label={`Quantité de ${food.name} en grammes`}
                          />
                          <span className="text-sm text-muted-foreground">g</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => removeScannedFood(index)}
                          aria-label={`Retirer ${food.name}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {food.source === "label" && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground">
                            {food.per100.calories} kcal · {food.per100.protein}g prot. · {food.per100.carbs}g gluc. · {food.per100.fat}g lip. / 100 g
                          </span>
                          {food.portionGrams && (
                            <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => updateScannedGrams(index, food.portionGrams!)}>
                              Portion ({food.portionGrams} g)
                            </Button>
                          )}
                          {food.packageGrams && (
                            <>
                              <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => updateScannedGrams(index, Math.round(food.packageGrams! / 2))}>
                                ½ paquet ({Math.round(food.packageGrams / 2)} g)
                              </Button>
                              <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => updateScannedGrams(index, food.packageGrams!)}>
                                Paquet entier ({food.packageGrams} g)
                              </Button>
                            </>
                          )}
                          {!food.grams && <span className="text-amber-600">Indique la quantité mangée</span>}
                        </div>
                      )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {foodSearch ? (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {foodSearch.mode === "replace"
                        ? `Remplacer « ${scannedFoods[foodSearch.index]?.name} »`
                        : "Ajouter un aliment"}
                    </p>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFoodSearch(null)} aria-label="Fermer la recherche">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="Ex: riz, œuf, poulet…"
                      value={foodQuery}
                      onChange={(e) => setFoodQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {foodResults.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => pickFood(item)}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-background transition-colors"
                      >
                        <p className="text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.calories} kcal · {item.protein}g prot. · {item.carbs}g gluc. · {item.fat}g lip. / 100 {item.unit}
                        </p>
                      </button>
                    ))}
                    {foodQuery.trim() && foodResults.length === 0 && (
                      <p className="text-sm text-muted-foreground px-3 py-2">Aucun aliment trouvé</p>
                    )}
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => openFoodSearch({ mode: "add" })}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter un aliment
                </Button>
              )}

              {scannedFoods.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-600">{scannedTotal.calories} cal</span>
                    <span className="px-2 py-1 rounded bg-green-500/10 text-green-600">P: {scannedTotal.protein}g</span>
                    <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-600">C: {scannedTotal.carbs}g</span>
                    <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-600">L: {scannedTotal.fats}g</span>
                  </div>

                  <div className="w-32">
                    <Label>Heure</Label>
                    <Input type="time" value={scanTime} onChange={(e) => setScanTime(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeScan}>
              Annuler
            </Button>
            <Button onClick={saveScannedMeal} disabled={scanStatus !== "done" || scannedFoods.length === 0 || missingGrams}>
              Ajouter « {scannedMealName} »
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pour personnaliser les objectifs nutritionnels */}
      <Dialog open={showMacroGoalsForm} onOpenChange={setShowMacroGoalsForm}>
        <DialogContent className="max-w-[90vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier les objectifs nutritionnels</DialogTitle>
            <DialogDescription>
              Par défaut, ces valeurs sont calculées à partir de votre profil et de votre objectif. Vous pouvez les ajuster ici.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Calories (kcal)</Label>
              <Input
                type="number"
                value={macroGoalsDraft.calories}
                onChange={(e) => setMacroGoalsDraft({ ...macroGoalsDraft, calories: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Protéines (g)</Label>
              <Input
                type="number"
                value={macroGoalsDraft.protein}
                onChange={(e) => setMacroGoalsDraft({ ...macroGoalsDraft, protein: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Glucides (g)</Label>
              <Input
                type="number"
                value={macroGoalsDraft.carbs}
                onChange={(e) => setMacroGoalsDraft({ ...macroGoalsDraft, carbs: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Lipides (g)</Label>
              <Input
                type="number"
                value={macroGoalsDraft.fats}
                onChange={(e) => setMacroGoalsDraft({ ...macroGoalsDraft, fats: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {hasCustomMacros && (
              <Button variant="outline" onClick={resetMacroGoals}>
                Réinitialiser aux valeurs recommandées
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowMacroGoalsForm(false)}>
              Annuler
            </Button>
            <Button onClick={saveMacroGoals}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
