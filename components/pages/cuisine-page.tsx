'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, ChefHat, Clock, Users, Trash2, Edit, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface Ingredient {
  name: string
  quantity: string
  unit: string
}

interface Recipe {
  id: string
  name: string
  description?: string
  ingredients: Ingredient[]
  protein?: number
  carbs?: number
  fat?: number
  calories?: number
  prepTime?: number
  cookTime?: number
  servings?: number
  category?: string
  imageUrl?: string
  createdAt: string
  updatedAt: string
}

const CATEGORIES = ['Entrée', 'Plat', 'Dessert', 'Accompagnement', 'Boisson', 'Snack', 'Petit-déjeuner']

export function CuisinePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: '', unit: '' }])
  const [protein, setProtein] = useState<number | ''>('')
  const [carbs, setCarbs] = useState<number | ''>('')
  const [fat, setFat] = useState<number | ''>('')
  const [calories, setCalories] = useState<number | ''>('')
  const [prepTime, setPrepTime] = useState<number | ''>('')
  const [cookTime, setCookTime] = useState<number | ''>('')
  const [servings, setServings] = useState<number | ''>('')
  const [category, setCategory] = useState<string>('')

  useEffect(() => {
    fetchRecipes()
  }, [])

  const fetchRecipes = async () => {
    try {
      const response = await fetch('/api/recipes')
      if (response.ok) {
        const data = await response.json()
        setRecipes(data)
      }
    } catch (error) {
      console.error('Error fetching recipes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: '', unit: '' }])
  }

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
    const newIngredients = [...ingredients]
    newIngredients[index][field] = value
    setIngredients(newIngredients)
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setIngredients([{ name: '', quantity: '', unit: '' }])
    setProtein('')
    setCarbs('')
    setFat('')
    setCalories('')
    setPrepTime('')
    setCookTime('')
    setServings('')
    setCategory('')
    setEditingRecipe(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const recipeData = {
      id: editingRecipe?.id,
      name,
      description,
      ingredients: ingredients.filter(i => i.name),
      protein: protein === '' ? null : Number(protein),
      carbs: carbs === '' ? null : Number(carbs),
      fat: fat === '' ? null : Number(fat),
      calories: calories === '' ? null : Number(calories),
      prepTime: prepTime === '' ? null : Number(prepTime),
      cookTime: cookTime === '' ? null : Number(cookTime),
      servings: servings === '' ? null : Number(servings),
      category: category || null,
    }

    try {
      const url = editingRecipe ? '/api/recipes' : '/api/recipes'
      const method = editingRecipe ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipeData),
      })

      if (response.ok) {
        await fetchRecipes()
        setIsDialogOpen(false)
        resetForm()
      }
    } catch (error) {
      console.error('Error saving recipe:', error)
    }
  }

  const handleEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe)
    setName(recipe.name)
    setDescription(recipe.description || '')
    setIngredients(recipe.ingredients.length > 0 ? recipe.ingredients : [{ name: '', quantity: '', unit: '' }])
    setProtein(recipe.protein ?? '')
    setCarbs(recipe.carbs ?? '')
    setFat(recipe.fat ?? '')
    setCalories(recipe.calories ?? '')
    setPrepTime(recipe.prepTime ?? '')
    setCookTime(recipe.cookTime ?? '')
    setServings(recipe.servings ?? '')
    setCategory(recipe.category || '')
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette recette ?')) return

    try {
      const response = await fetch(`/api/recipes?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchRecipes()
      }
    } catch (error) {
      console.error('Error deleting recipe:', error)
    }
  }

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ChefHat className="size-8" />
            Cuisine
          </h1>
          <p className="text-muted-foreground">Gérez vos recettes et leurs informations nutritionnelles</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Nouvelle recette
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRecipe ? 'Modifier la recette' : 'Nouvelle recette'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nom */}
              <div className="space-y-2">
                <Label htmlFor="name">Nom de la recette *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ex: Poulet rôti aux légumes"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez votre recette..."
                  rows={3}
                />
              </div>

              {/* Catégorie */}
              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ingrédients */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Ingrédients</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddIngredient}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                {ingredients.map((ingredient, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Ingrédient"
                      value={ingredient.name}
                      onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Quantité"
                      value={ingredient.quantity}
                      onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)}
                      className="w-24"
                    />
                    <Input
                      placeholder="Unité"
                      value={ingredient.unit}
                      onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                      className="w-20"
                    />
                    {ingredients.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveIngredient(index)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Macros */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="protein">Protéines (g)</Label>
                  <Input
                    id="protein"
                    type="number"
                    step="0.1"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carbs">Glucides (g)</Label>
                  <Input
                    id="carbs"
                    type="number"
                    step="0.1"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fat">Lipides (g)</Label>
                  <Input
                    id="fat"
                    type="number"
                    step="0.1"
                    value={fat}
                    onChange={(e) => setFat(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calories">Calories (kcal)</Label>
                  <Input
                    id="calories"
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Temps et portions */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prepTime">Préparation (min)</Label>
                  <Input
                    id="prepTime"
                    type="number"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cookTime">Cuisson (min)</Label>
                  <Input
                    id="cookTime"
                    type="number"
                    value={cookTime}
                    onChange={(e) => setCookTime(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="servings">Portions</Label>
                  <Input
                    id="servings"
                    type="number"
                    value={servings}
                    onChange={(e) => setServings(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => {
                  setIsDialogOpen(false)
                  resetForm()
                }}>
                  Annuler
                </Button>
                <Button type="submit">
                  {editingRecipe ? 'Modifier' : 'Créer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une recette..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Recipes Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : filteredRecipes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ChefHat className="size-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Aucune recette trouvée' 
                : 'Aucune recette. Créez-en une !'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map(recipe => (
            <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-1">{recipe.name}</CardTitle>
                    {recipe.category && (
                      <Badge variant="secondary" className="mt-2">{recipe.category}</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(recipe)}>
                      <Edit className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(recipe.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {recipe.description && (
                  <CardDescription className="line-clamp-2">{recipe.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Info badges */}
                <div className="flex flex-wrap gap-2 text-sm">
                  {recipe.prepTime && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3" />
                      <span>{recipe.prepTime}min</span>
                    </div>
                  )}
                  {recipe.servings && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="size-3" />
                      <span>{recipe.servings} parts</span>
                    </div>
                  )}
                </div>

                {/* Macros */}
                {(recipe.protein || recipe.carbs || recipe.fat || recipe.calories) && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {recipe.calories && (
                      <div className="bg-primary/10 rounded px-2 py-1">
                        <div className="font-semibold">{recipe.calories} kcal</div>
                        <div className="text-muted-foreground">Calories</div>
                      </div>
                    )}
                    {recipe.protein && (
                      <div className="bg-blue-500/10 rounded px-2 py-1">
                        <div className="font-semibold">{recipe.protein}g</div>
                        <div className="text-muted-foreground">Protéines</div>
                      </div>
                    )}
                    {recipe.carbs && (
                      <div className="bg-orange-500/10 rounded px-2 py-1">
                        <div className="font-semibold">{recipe.carbs}g</div>
                        <div className="text-muted-foreground">Glucides</div>
                      </div>
                    )}
                    {recipe.fat && (
                      <div className="bg-yellow-500/10 rounded px-2 py-1">
                        <div className="font-semibold">{recipe.fat}g</div>
                        <div className="text-muted-foreground">Lipides</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Ingredients count */}
                {recipe.ingredients.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {recipe.ingredients.length} ingrédient{recipe.ingredients.length > 1 ? 's' : ''}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
