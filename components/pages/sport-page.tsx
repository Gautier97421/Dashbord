"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/lib/store"
import { generateId, getToday } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Dumbbell, Plus, Trash2, TrendingUp, Apple, Trophy, User, Calendar as CalendarIcon } from "lucide-react"
import type { WorkoutSession, PersonalRecord, FitnessProfile, DailyNutrition, Meal, ActivityType, FitnessGoal } from "@/lib/types"

export function SportPage() {
  const { state, dispatch } = useApp()
  const [activeTab, setActiveTab] = useState("workouts")
  const [showWorkoutForm, setShowWorkoutForm] = useState(false)
  const [showPRForm, setShowPRForm] = useState(false)
  const [showMealForm, setShowMealForm] = useState(false)
  const [showProfileForm, setShowProfileForm] = useState(!state.fitnessProfile)
  const [selectedDate, setSelectedDate] = useState(getToday())

  // États pour les formulaires
  const [newWorkout, setNewWorkout] = useState<Partial<WorkoutSession>>({
    date: getToday(),
    type: "gym",
    customType: "",
    duration: 60,
    intensity: "moderate",
  })

  const [newPR, setNewPR] = useState<Partial<PersonalRecord>>({
    exercise: "",
    value: 0,
    reps: 1,
    unit: "kg",
    date: getToday(),
  })

  const [newMeal, setNewMeal] = useState<Partial<Meal>>({
    name: "",
    time: "12:00",
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  })

  const [profileForm, setProfileForm] = useState<FitnessProfile>(
    state.fitnessProfile || {
      age: 25,
      weight: 70,
      height: 170,
      gender: "male",
      goal: "maintenance",
      activityLevel: "moderate",
    }
  )

  // Calculer les macros recommandées basé sur le profil
  const calculateMacros = (profile: FitnessProfile) => {
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
      "very-active": 1.9,
    }

    let calories = bmr * activityFactors[profile.activityLevel]

    // Ajustement selon l'objectif
    if (profile.goal === "weight-loss") {
      calories -= 500 // Déficit de 500 cal pour perdre ~0.5kg/semaine
    } else if (profile.goal === "muscle-gain") {
      calories += 300 // Surplus de 300 cal pour prise de masse
    }

    // Répartition des macros
    const protein = profile.goal === "muscle-gain" ? profile.weight * 2.2 : profile.weight * 1.8
    const fats = calories * 0.25 / 9 // 25% des calories en lipides
    const carbs = (calories - (protein * 4) - (fats * 9)) / 4

    return {
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fats: Math.round(fats),
    }
  }

  const recommendedMacros = state.fitnessProfile ? calculateMacros(state.fitnessProfile) : null

  // Nutrition du jour
  const todayNutrition = state.dailyNutrition.find((n) => n.date === getToday())

  // Fonctions calendrier pour workouts
  const getMonthWorkouts = () => {
    const date = new Date(selectedDate)
    const year = date.getFullYear()
    const month = date.getMonth()
    
    return state.workoutSessions.filter((workout) => {
      const workoutDate = new Date(workout.date)
      return workoutDate.getFullYear() === year && workoutDate.getMonth() === month
    })
  }

  const getCalendarDays = () => {
    const date = new Date(selectedDate)
    const year = date.getFullYear()
    const month = date.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startingDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()
    
    const days = []
    
    // Jours du mois précédent
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i)
      days.push({ date: prevDate, isCurrentMonth: false })
    }
    
    // Jours du mois actuel
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(year, month, i)
      days.push({ date: currentDate, isCurrentMonth: true })
    }
    
    return days
  }

  const getWorkoutForDate = (dateStr: string) => {
    return state.workoutSessions.find((workout) => workout.date === dateStr)
  }

  const navigateMonth = (direction: number) => {
    const date = new Date(selectedDate)
    date.setMonth(date.getMonth() + direction)
    setSelectedDate(date.toISOString().split("T")[0])
  }

  const calendarDays = getCalendarDays()

  const addWorkout = () => {
    if (!newWorkout.type || !newWorkout.duration) return

    const workout: WorkoutSession = {
      id: generateId(),
      date: newWorkout.date || getToday(),
      type: newWorkout.type as ActivityType,
      customType: newWorkout.type === "other" ? newWorkout.customType : undefined,
      duration: newWorkout.duration,
      notes: newWorkout.notes,
      intensity: newWorkout.intensity || "moderate",
    }

    dispatch({ type: "ADD_WORKOUT", payload: workout })
    setShowWorkoutForm(false)
    setNewWorkout({ date: getToday(), type: "gym", customType: "", duration: 60, intensity: "moderate" })
  }

  const deleteWorkout = (id: string) => {
    dispatch({ type: "DELETE_WORKOUT", payload: id })
  }

  const addPR = () => {
    if (!newPR.exercise || !newPR.value) return

    const pr: PersonalRecord = {
      id: generateId(),
      exercise: newPR.exercise,
      value: newPR.value,
      reps: newPR.reps,
      unit: newPR.unit || "kg",
      date: newPR.date || getToday(),
    }

    dispatch({ type: "ADD_PERSONAL_RECORD", payload: pr })
    setShowPRForm(false)
    setNewPR({ exercise: "", value: 0, reps: 1, unit: "kg", date: getToday() })
  }

  const deletePR = (id: string) => {
    dispatch({ type: "DELETE_PERSONAL_RECORD", payload: id })
  }

  const saveProfile = () => {
    dispatch({ type: "UPDATE_FITNESS_PROFILE", payload: profileForm })
    setShowProfileForm(false)
  }

  const addMeal = () => {
    if (!newMeal.name) return

    const meal: Meal = {
      id: generateId(),
      name: newMeal.name,
      time: newMeal.time || "12:00",
      calories: newMeal.calories || 0,
      protein: newMeal.protein || 0,
      carbs: newMeal.carbs || 0,
      fats: newMeal.fats || 0,
    }

    if (todayNutrition) {
      const updated: DailyNutrition = {
        ...todayNutrition,
        meals: [...todayNutrition.meals, meal],
        calories: todayNutrition.calories + meal.calories,
        protein: todayNutrition.protein + meal.protein,
        carbs: todayNutrition.carbs + meal.carbs,
        fats: todayNutrition.fats + meal.fats,
      }
      dispatch({ type: "UPDATE_DAILY_NUTRITION", payload: updated })
    } else {
      const newNutrition: DailyNutrition = {
        id: generateId(),
        date: getToday(),
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fats: meal.fats,
        meals: [meal],
      }
      dispatch({ type: "ADD_DAILY_NUTRITION", payload: newNutrition })
    }

    setShowMealForm(false)
    setNewMeal({ name: "", time: "12:00", calories: 0, protein: 0, carbs: 0, fats: 0 })
  }

  const deleteMeal = (mealId: string) => {
    if (!todayNutrition) return

    const meal = todayNutrition.meals.find((m) => m.id === mealId)
    if (!meal) return

    const updated: DailyNutrition = {
      ...todayNutrition,
      meals: todayNutrition.meals.filter((m) => m.id !== mealId),
      calories: todayNutrition.calories - meal.calories,
      protein: todayNutrition.protein - meal.protein,
      carbs: todayNutrition.carbs - meal.carbs,
      fats: todayNutrition.fats - meal.fats,
    }
    dispatch({ type: "UPDATE_DAILY_NUTRITION", payload: updated })
  }

  // Statistiques
  const last30DaysWorkouts = state.workoutSessions.filter((w) => {
    const workoutDate = new Date(w.date)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return workoutDate >= thirtyDaysAgo
  })

  const totalWorkouts = last30DaysWorkouts.length
  const totalDuration = last30DaysWorkouts.reduce((acc, w) => acc + w.duration, 0)
  const avgDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0

  const activityTypeLabels = {
    gym: "Salle de sport",
    running: "Course",
    climbing: "Escalade",
    other: "Autre",
  }

  const intensityLabels = {
    light: "Légère",
    moderate: "Modérée",
    intense: "Intense",
  }

  const goalLabels = {
    "weight-loss": "Perte de poids",
    "muscle-gain": "Prise de masse",
    maintenance: "Maintenance",
  }

  if (showProfileForm && !state.fitnessProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Dumbbell className="h-8 w-8" />
            Sport & Nutrition
          </h1>
          <p className="text-muted-foreground">Configuration de votre profil</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Créez votre profil fitness</CardTitle>
            <CardDescription>Ces informations nous permettront de calculer vos besoins nutritionnels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Âge</Label>
                <Input
                  type="number"
                  value={profileForm.age}
                  onChange={(e) => setProfileForm({ ...profileForm, age: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Sexe</Label>
                <Select
                  value={profileForm.gender}
                  onValueChange={(value) => setProfileForm({ ...profileForm, gender: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Homme</SelectItem>
                    <SelectItem value="female">Femme</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Poids (kg)</Label>
                <Input
                  type="number"
                  value={profileForm.weight}
                  onChange={(e) => setProfileForm({ ...profileForm, weight: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Taille (cm)</Label>
                <Input
                  type="number"
                  value={profileForm.height}
                  onChange={(e) => setProfileForm({ ...profileForm, height: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>Objectif</Label>
              <Select
                value={profileForm.goal}
                onValueChange={(value) => setProfileForm({ ...profileForm, goal: value as FitnessGoal })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight-loss">Perte de poids</SelectItem>
                  <SelectItem value="muscle-gain">Prise de masse</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Niveau d'activité</Label>
              <Select
                value={profileForm.activityLevel}
                onValueChange={(value) => setProfileForm({ ...profileForm, activityLevel: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sédentaire (peu ou pas d'exercice)</SelectItem>
                  <SelectItem value="light">Léger (1-3 jours/semaine)</SelectItem>
                  <SelectItem value="moderate">Modéré (3-5 jours/semaine)</SelectItem>
                  <SelectItem value="active">Actif (6-7 jours/semaine)</SelectItem>
                  <SelectItem value="very-active">Très actif (2x par jour)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Poids cible (optionnel)</Label>
              <Input
                type="number"
                placeholder="Ex: 75"
                value={profileForm.targetWeight || ""}
                onChange={(e) => setProfileForm({ ...profileForm, targetWeight: parseFloat(e.target.value) || undefined })}
              />
            </div>

            <Button onClick={saveProfile} className="w-full">
              Enregistrer mon profil
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Dumbbell className="h-8 w-8" />
          Sport & Nutrition
        </h1>
        <p className="text-muted-foreground">Suivez vos entraînements et votre alimentation</p>
      </div>

      {/* Stats globales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Entraînements (30j)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalWorkouts}</div>
            <p className="text-xs text-muted-foreground">{Math.round(totalDuration / 60)}h totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Durée moyenne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgDuration}min</div>
            <p className="text-xs text-muted-foreground">Par session</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Personal Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{state.personalRecords.length}</div>
            <p className="text-xs text-muted-foreground">Performances</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Poids actuel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{state.fitnessProfile?.weight || "-"} kg</div>
            {state.fitnessProfile?.targetWeight && (
              <p className="text-xs text-muted-foreground">
                Objectif: {state.fitnessProfile.targetWeight} kg
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="workouts">
            <Dumbbell className="mr-2 h-4 w-4" />
            Entraînements
          </TabsTrigger>
          <TabsTrigger value="nutrition">
            <Apple className="mr-2 h-4 w-4" />
            Nutrition
          </TabsTrigger>
          <TabsTrigger value="prs">
            <Trophy className="mr-2 h-4 w-4" />
            Records
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profil
          </TabsTrigger>
        </TabsList>

        {/* Onglet Entraînements */}
        <TabsContent value="workouts" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Calendrier d'entraînement</CardTitle>
                  <CardDescription>
                    {new Date(selectedDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                    ←
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedDate(getToday())}>
                    Aujourd'hui
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
                    →
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Calendrier */}
              <div className="border rounded-lg overflow-hidden">
                {/* Jours de la semaine */}
                <div className="grid grid-cols-7 bg-muted">
                  {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                    <div key={day} className="p-2 text-center text-sm font-semibold">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Grille du calendrier */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((day, index) => {
                    const dateStr = day.date.toISOString().split("T")[0]
                    const workout = getWorkoutForDate(dateStr)
                    const isToday = dateStr === getToday()
                    
                    return (
                      <div
                        key={index}
                        className={`
                          min-h-24 p-2 border-t border-r relative cursor-pointer hover:bg-accent/50 transition-colors
                          ${!day.isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""}
                          ${isToday ? "bg-primary/5 ring-2 ring-primary ring-inset" : ""}
                          ${workout ? "bg-green-50 dark:bg-green-950/20" : ""}
                        `}
                        onClick={() => {
                          setNewWorkout({
                            ...newWorkout,
                            date: dateStr,
                          })
                          setShowWorkoutForm(true)
                        }}
                      >
                        <div className="text-sm font-semibold mb-1">
                          {day.date.getDate()}
                        </div>
                        {workout && (
                          <div className="space-y-1">
                            <div className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-1 py-0.5 rounded">
                              {workout.type === "other" && workout.customType ? workout.customType : activityTypeLabels[workout.type]}
                            </div>
                            <div className="text-xs font-semibold">
                              {workout.duration} min
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Dialog pour ajout/édition */}
              <Dialog open={showWorkoutForm} onOpenChange={setShowWorkoutForm}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enregistrer l'entraînement</DialogTitle>
                    <DialogDescription>
                      {new Date(newWorkout.date || getToday()).toLocaleDateString("fr-FR", { dateStyle: "full" })}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Type d'activité</Label>
                      <Select
                        value={newWorkout.type}
                        onValueChange={(value) => setNewWorkout({ ...newWorkout, type: value as ActivityType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gym">Salle de sport</SelectItem>
                          <SelectItem value="running">Course</SelectItem>
                          <SelectItem value="climbing">Escalade</SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {newWorkout.type === "other" && (
                      <div>
                        <Label>Nom du sport</Label>
                        <Input
                          placeholder="Ex: Tennis, Natation, Yoga..."
                          value={newWorkout.customType || ""}
                          onChange={(e) => setNewWorkout({ ...newWorkout, customType: e.target.value })}
                        />
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Durée (minutes)</Label>
                        <Input
                          type="number"
                          value={newWorkout.duration}
                          onChange={(e) => setNewWorkout({ ...newWorkout, duration: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Intensité</Label>
                        <Select
                          value={newWorkout.intensity}
                          onValueChange={(value) => setNewWorkout({ ...newWorkout, intensity: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Légère</SelectItem>
                            <SelectItem value="moderate">Modérée</SelectItem>
                            <SelectItem value="intense">Intense</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Notes (optionnel)</Label>
                      <Input
                        placeholder="Ex: Jambes, cardio..."
                        value={newWorkout.notes || ""}
                        onChange={(e) => setNewWorkout({ ...newWorkout, notes: e.target.value })}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    {getWorkoutForDate(newWorkout.date || getToday()) && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          const workout = getWorkoutForDate(newWorkout.date || getToday())
                          if (workout) deleteWorkout(workout.id)
                          setShowWorkoutForm(false)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setShowWorkoutForm(false)}>
                      Annuler
                    </Button>
                    <Button onClick={addWorkout}>Enregistrer</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Nutrition */}
        <TabsContent value="nutrition" className="space-y-6">
          {recommendedMacros && (
            <Card>
              <CardHeader>
                <CardTitle>Objectifs nutritionnels du jour</CardTitle>
                <CardDescription>Basé sur votre profil ({goalLabels[state.fitnessProfile!.goal]})</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg border">
                    <p className="text-2xl font-bold">{recommendedMacros.calories}</p>
                    <p className="text-sm text-muted-foreground">Calories</p>
                    {todayNutrition && (
                      <p className="text-xs mt-1">{todayNutrition.calories}/{recommendedMacros.calories}</p>
                    )}
                  </div>
                  <div className="text-center p-4 rounded-lg border">
                    <p className="text-2xl font-bold">{recommendedMacros.protein}g</p>
                    <p className="text-sm text-muted-foreground">Protéines</p>
                    {todayNutrition && (
                      <p className="text-xs mt-1">{todayNutrition.protein}g/{recommendedMacros.protein}g</p>
                    )}
                  </div>
                  <div className="text-center p-4 rounded-lg border">
                    <p className="text-2xl font-bold">{recommendedMacros.carbs}g</p>
                    <p className="text-sm text-muted-foreground">Glucides</p>
                    {todayNutrition && (
                      <p className="text-xs mt-1">{todayNutrition.carbs}g/{recommendedMacros.carbs}g</p>
                    )}
                  </div>
                  <div className="text-center p-4 rounded-lg border">
                    <p className="text-2xl font-bold">{recommendedMacros.fats}g</p>
                    <p className="text-sm text-muted-foreground">Lipides</p>
                    {todayNutrition && (
                      <p className="text-xs mt-1">{todayNutrition.fats}g/{recommendedMacros.fats}g</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conseils nutritionnels */}
          <Card>
            <CardHeader>
              <CardTitle>💡 Conseils nutritionnels</CardTitle>
              <CardDescription>Recommandations pour optimiser vos performances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Répartition des repas */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    🍽️ Répartition des repas
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm font-medium">Petit-déjeuner</p>
                      <p className="text-2xl font-bold text-blue-600">25%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                      <p className="text-sm font-medium">Déjeuner</p>
                      <p className="text-2xl font-bold text-green-600">30%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm font-medium">Collation</p>
                      <p className="text-2xl font-bold text-yellow-600">15%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                      <p className="text-sm font-medium">Dîner</p>
                      <p className="text-2xl font-bold text-orange-600">30%</p>
                    </div>
                  </div>
                </div>

                {/* Hydratation et Sommeil */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">💧</div>
                      <div>
                        <p className="font-semibold text-cyan-700 dark:text-cyan-400">Hydratation</p>
                        <p className="text-2xl font-bold text-cyan-600">2–2,5 L</p>
                        <p className="text-sm text-muted-foreground">par jour</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">😴</div>
                      <div>
                        <p className="font-semibold text-purple-700 dark:text-purple-400">Sommeil</p>
                        <p className="text-2xl font-bold text-purple-600">7–9 h</p>
                        <p className="text-sm text-muted-foreground">Clé pour la prise de masse</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Repas d'aujourd'hui</CardTitle>
                  <CardDescription>{new Date().toLocaleDateString("fr-FR", { dateStyle: "full" })}</CardDescription>
                </div>
                <Button onClick={() => setShowMealForm(!showMealForm)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un repas
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showMealForm && (
                <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nom du repas</Label>
                      <Input
                        placeholder="Ex: Petit-déjeuner, Déjeuner..."
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
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label>Calories</Label>
                      <Input
                        type="number"
                        value={newMeal.calories}
                        onChange={(e) => setNewMeal({ ...newMeal, calories: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Protéines (g)</Label>
                      <Input
                        type="number"
                        value={newMeal.protein}
                        onChange={(e) => setNewMeal({ ...newMeal, protein: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Glucides (g)</Label>
                      <Input
                        type="number"
                        value={newMeal.carbs}
                        onChange={(e) => setNewMeal({ ...newMeal, carbs: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Lipides (g)</Label>
                      <Input
                        type="number"
                        value={newMeal.fats}
                        onChange={(e) => setNewMeal({ ...newMeal, fats: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addMeal}>Ajouter</Button>
                    <Button variant="outline" onClick={() => setShowMealForm(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {todayNutrition?.meals
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((meal) => (
                    <div
                      key={meal.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-semibold">{meal.name}</p>
                            <p className="text-sm text-muted-foreground">{meal.time}</p>
                          </div>
                          <div className="flex gap-2 text-sm">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMeal(meal.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                {!todayNutrition || todayNutrition.meals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun repas enregistré aujourd'hui
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Personal Records */}
        <TabsContent value="prs" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Personal Records</CardTitle>
                  <CardDescription>Vos meilleures performances</CardDescription>
                </div>
                <Button onClick={() => setShowPRForm(!showPRForm)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un PR
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showPRForm && (
                <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Exercice</Label>
                      <Input
                        placeholder="Ex: Squat, Bench Press..."
                        value={newPR.exercise}
                        onChange={(e) => setNewPR({ ...newPR, exercise: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={newPR.date}
                        onChange={(e) => setNewPR({ ...newPR, date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Valeur</Label>
                      <Input
                        type="number"
                        value={newPR.value}
                        onChange={(e) => setNewPR({ ...newPR, value: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Répétitions</Label>
                      <Input
                        type="number"
                        value={newPR.reps}
                        onChange={(e) => setNewPR({ ...newPR, reps: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Unité</Label>
                      <Select
                        value={newPR.unit}
                        onValueChange={(value) => setNewPR({ ...newPR, unit: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="reps">reps</SelectItem>
                          <SelectItem value="km">km</SelectItem>
                          <SelectItem value="min">min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addPR}>Enregistrer</Button>
                    <Button variant="outline" onClick={() => setShowPRForm(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {state.personalRecords
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((pr) => (
                    <div
                      key={pr.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <Trophy className="h-8 w-8 text-yellow-500" />
                        <div>
                          <p className="font-semibold">{pr.exercise}</p>
                          <p className="text-2xl font-bold">
                            {pr.value} {pr.unit} {pr.reps && pr.reps > 1 ? `x ${pr.reps}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(pr.date).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePR(pr.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                {state.personalRecords.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 col-span-2">
                    Aucun record personnel enregistré
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Profil */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Mon profil fitness</CardTitle>
                  <CardDescription>Informations personnelles et objectifs</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setShowProfileForm(true)}>
                  Modifier
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {state.fitnessProfile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">Âge</p>
                      <p className="text-2xl font-bold">{state.fitnessProfile.age} ans</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">Poids</p>
                      <p className="text-2xl font-bold">{state.fitnessProfile.weight} kg</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">Taille</p>
                      <p className="text-2xl font-bold">{state.fitnessProfile.height} cm</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">Objectif</p>
                      <p className="text-lg font-semibold">{goalLabels[state.fitnessProfile.goal]}</p>
                    </div>
                  </div>

                  {recommendedMacros && (
                    <div className="p-4 rounded-lg bg-muted">
                      <h4 className="font-semibold mb-2">Besoins nutritionnels quotidiens</h4>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Calories</p>
                          <p className="text-lg font-bold">{recommendedMacros.calories}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Protéines</p>
                          <p className="text-lg font-bold">{recommendedMacros.protein}g</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Glucides</p>
                          <p className="text-lg font-bold">{recommendedMacros.carbs}g</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Lipides</p>
                          <p className="text-lg font-bold">{recommendedMacros.fats}g</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">Aucun profil configuré</p>
              )}
            </CardContent>
          </Card>

          {showProfileForm && state.fitnessProfile && (
            <Card>
              <CardHeader>
                <CardTitle>Modifier mon profil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Âge</Label>
                    <Input
                      type="number"
                      value={profileForm.age}
                      onChange={(e) => setProfileForm({ ...profileForm, age: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Sexe</Label>
                    <Select
                      value={profileForm.gender}
                      onValueChange={(value) => setProfileForm({ ...profileForm, gender: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Homme</SelectItem>
                        <SelectItem value="female">Femme</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Poids (kg)</Label>
                    <Input
                      type="number"
                      value={profileForm.weight}
                      onChange={(e) => setProfileForm({ ...profileForm, weight: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Taille (cm)</Label>
                    <Input
                      type="number"
                      value={profileForm.height}
                      onChange={(e) => setProfileForm({ ...profileForm, height: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <Label>Objectif</Label>
                  <Select
                    value={profileForm.goal}
                    onValueChange={(value) => setProfileForm({ ...profileForm, goal: value as FitnessGoal })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weight-loss">Perte de poids</SelectItem>
                      <SelectItem value="muscle-gain">Prise de masse</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Niveau d'activité</Label>
                  <Select
                    value={profileForm.activityLevel}
                    onValueChange={(value) => setProfileForm({ ...profileForm, activityLevel: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">Sédentaire</SelectItem>
                      <SelectItem value="light">Léger</SelectItem>
                      <SelectItem value="moderate">Modéré</SelectItem>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="very-active">Très actif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveProfile}>Enregistrer</Button>
                  <Button variant="outline" onClick={() => setShowProfileForm(false)}>
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
