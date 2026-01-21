"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/lib/store-api"
import { generateId, getToday } from "@/lib/helpers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Dumbbell, Plus, Trash2, TrendingUp, Apple, Trophy, User, Calendar as CalendarIcon, Droplets, Moon, Calendar, Clock, CheckCircle2 } from "lucide-react"
import type { WorkoutSession, PersonalRecord, FitnessProfile, DailyNutrition, Meal, ActivityType, FitnessGoal, WorkoutProgram, WorkoutProgramSession, Mission, TimeFrame, Priority, TaskStatus } from "@/lib/types"

// Ordre des jours : Lundi à Dimanche (dimanche en dernier)
const DAYS_ORDER = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
const DAYS_VALUES = [1, 2, 3, 4, 5, 6, 0] // dayOfWeek correspondant (dimanche = 0 en dernier)
const DAYS_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

export function SportPage() {
  const { state, dispatch, updateFitnessProfile, addWorkoutProgram, updateWorkoutProgram, deleteWorkoutProgram, addMission } = useApp()
  const [activeTab, setActiveTab] = useState("workouts")
  const [showWorkoutForm, setShowWorkoutForm] = useState(false)
  const [showPRForm, setShowPRForm] = useState(false)
  const [showMealForm, setShowMealForm] = useState(false)
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)
  const [showProfileForm, setShowProfileForm] = useState(!state.fitnessProfile)
  const [showProgramForm, setShowProgramForm] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null)
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [applyWeeks, setApplyWeeks] = useState(4)
  const [selectedDate, setSelectedDate] = useState(getToday())

  // Nettoyer automatiquement les entraînements passés non complétés
  useEffect(() => {
    const today = getToday()
    const pastIncompleteWorkouts = state.workoutSessions.filter(
      (workout) => workout.date < today && !workout.completed
    )
    
    if (pastIncompleteWorkouts.length > 0) {
      pastIncompleteWorkouts.forEach((workout) => {
        dispatch({ type: "DELETE_WORKOUT", payload: workout.id })
      })
    }
  }, [state.workoutSessions, dispatch])

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

  const [newProgram, setNewProgram] = useState<Partial<WorkoutProgram>>({
    name: "",
    description: "",
    sessions: [],
    active: true,
    autoCreateMissions: false,
  })

  const [newProgramSession, setNewProgramSession] = useState<Partial<WorkoutProgramSession>>({
    dayOfWeek: 1,
    type: "gym",
    customType: "",
    duration: 60,
    intensity: "moderate",
  })

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

  // Calcul de l'hydratation recommandée (30-35ml par kg)
  const calculateHydration = (profile: FitnessProfile) => {
    const baseHydration = profile.weight * 0.035 // 35ml par kg
    const min = Math.round((profile.weight * 0.030) * 10) / 10 // 30ml par kg
    const max = Math.round((profile.weight * 0.035) * 10) / 10 // 35ml par kg
    return { min, max }
  }

  const recommendedHydration = state.fitnessProfile ? calculateHydration(state.fitnessProfile) : null

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
    return state.workoutSessions.filter((workout) => workout.date === dateStr)
  }

  const navigateMonth = (direction: number) => {
    const date = new Date(selectedDate)
    date.setMonth(date.getMonth() + direction)
    setSelectedDate(date.toISOString().split("T")[0])
  }

  const calendarDays = getCalendarDays()

  const addWorkout = () => {
    if (!newWorkout.type || !newWorkout.duration) return

    if (editingWorkout) {
      // Mode édition
      const updated: WorkoutSession = {
        ...editingWorkout,
        type: newWorkout.type as ActivityType,
        customType: newWorkout.type === "other" ? newWorkout.customType : undefined,
        duration: newWorkout.duration!,
        notes: newWorkout.notes,
        intensity: newWorkout.intensity || "moderate",
      }
      dispatch({ type: "UPDATE_WORKOUT", payload: updated })
      setEditingWorkout(null)
    } else {
      // Mode ajout
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
    }

    setShowWorkoutForm(false)
    setNewWorkout({ date: getToday(), type: "gym", customType: "", duration: 60, intensity: "moderate" })
  }

  const editWorkout = (workout: WorkoutSession) => {
    setEditingWorkout(workout)
    setNewWorkout({
      date: workout.date,
      type: workout.type,
      customType: workout.customType || "",
      duration: workout.duration,
      notes: workout.notes,
      intensity: workout.intensity,
    })
    setShowWorkoutForm(true)
  }

  const deleteWorkout = (id: string) => {
    dispatch({ type: "DELETE_WORKOUT", payload: id })
  }

  const toggleWorkoutCompletion = (workout: WorkoutSession) => {
    dispatch({
      type: "UPDATE_WORKOUT",
      payload: { ...workout, completed: !workout.completed },
    })
  }

  // Gestion des programmes
  const generateProgramWorkouts = (program: WorkoutProgram, startDate: string, weeks: number = 4) => {
    const workouts: WorkoutSession[] = []
    const start = new Date(startDate)

    for (let week = 0; week < weeks; week++) {
      program.sessions.forEach((session) => {
        const date = new Date(start)
        date.setDate(start.getDate() + week * 7 + (session.dayOfWeek - start.getDay() + 7) % 7)
        
        const workout: WorkoutSession = {
          id: generateId(),
          date: date.toISOString().split("T")[0],
          type: session.type,
          customType: session.customType,
          duration: session.duration,
          intensity: session.intensity,
          notes: session.notes,
          programId: program.id,
        }
        workouts.push(workout)
      })
    }

    return workouts
  }

  const applyProgram = (programId: string, weeks: number = 4) => {
    const program = state.workoutPrograms.find((p) => p.id === programId)
    if (!program) return

    const workouts = generateProgramWorkouts(program, getToday(), weeks)
    
    // Filtrer les workouts qui n'existent pas déjà (éviter les doublons)
    const newWorkouts = workouts.filter((workout) => {
      // Vérifier s'il existe déjà un workout du même programme à la même date
      const existingWorkout = state.workoutSessions.find(
        (w) => w.programId === program.id && w.date === workout.date
      )
      return !existingWorkout
    })

    // Ajouter uniquement les nouveaux workouts
    newWorkouts.forEach((workout) => {
      dispatch({ type: "ADD_WORKOUT", payload: workout })
    })

    // Créer les missions si activé ET si le programme est actif
    if (program.autoCreateMissions && program.active) {
      newWorkouts.forEach((workout) => {
        const mission = state.missions.find(
          (m) => m.timeFrame === "day" && m.dueDate === workout.date && m.title.includes(program.name)
        )
        if (!mission) {
          const newMission = {
            id: generateId(),
            title: `${program.name} - ${activityTypeLabels[workout.type]}`,
            description: `Séance de ${workout.duration} min`,
            timeFrame: "day" as TimeFrame,
            priority: "medium" as Priority,
            status: "todo" as TaskStatus,
            tasks: [],
            dueDate: workout.date,
            createdAt: new Date().toISOString(),
          }
          dispatch({ type: "ADD_MISSION", payload: newMission })
          
          // Lier le workout à la mission
          dispatch({
            type: "UPDATE_WORKOUT",
            payload: { ...workout, missionId: newMission.id },
          })
        }
      })
    }
  }

  const addProgramSession = () => {
    if (newProgramSession.dayOfWeek === undefined || !newProgramSession.type || !newProgramSession.duration) return

    const session: WorkoutProgramSession = {
      id: generateId(),
      dayOfWeek: newProgramSession.dayOfWeek!,
      type: newProgramSession.type as ActivityType,
      customType: newProgramSession.type === "other" ? newProgramSession.customType : undefined,
      duration: newProgramSession.duration,
      intensity: newProgramSession.intensity || "moderate",
      time: newProgramSession.time,
      notes: newProgramSession.notes,
    }

    setNewProgram({
      ...newProgram,
      sessions: [...(newProgram.sessions || []), session],
    })

    setNewProgramSession({
      dayOfWeek: 1,
      type: "gym",
      customType: "",
      duration: 60,
      intensity: "moderate",
      time: undefined,
    })
  }

  const removeProgramSession = (id: string) => {
    setNewProgram({
      ...newProgram,
      sessions: (newProgram.sessions || []).filter((s) => s.id !== id),
    })
  }

  const saveProgram = async () => {
    if (!newProgram.name || !newProgram.sessions || newProgram.sessions.length === 0) return

    await addWorkoutProgram({
      name: newProgram.name,
      description: newProgram.description,
      sessions: newProgram.sessions,
      active: newProgram.active ?? true,
      autoCreateMissions: newProgram.autoCreateMissions ?? false,
    })

    setShowProgramForm(false)
    setNewProgram({
      name: "",
      description: "",
      sessions: [],
      active: true,
      autoCreateMissions: false,
    })
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

  const saveProfile = async () => {
    try {
      await updateFitnessProfile(profileForm)
      setShowProfileForm(false)
    } catch (error) {
      console.error('Error saving profile:', error)
    }
  }

  const saveMeal = () => {
    if (!newMeal.name) return

    if (editingMeal) {
      // Mode édition
      if (!todayNutrition) return

      const oldMeal = todayNutrition.meals.find(m => m.id === editingMeal.id)!
      const updatedMeals = todayNutrition.meals.map(m =>
        m.id === editingMeal.id
          ? {
              ...m,
              name: newMeal.name!,
              time: newMeal.time || "12:00",
              calories: newMeal.calories || 0,
              protein: newMeal.protein || 0,
              carbs: newMeal.carbs || 0,
              fats: newMeal.fats || 0,
            }
          : m
      )

      const updated: DailyNutrition = {
        ...todayNutrition,
        meals: updatedMeals,
        calories: todayNutrition.calories - oldMeal.calories + (newMeal.calories || 0),
        protein: todayNutrition.protein - oldMeal.protein + (newMeal.protein || 0),
        carbs: todayNutrition.carbs - oldMeal.carbs + (newMeal.carbs || 0),
        fats: todayNutrition.fats - oldMeal.fats + (newMeal.fats || 0),
      }
      dispatch({ type: "UPDATE_DAILY_NUTRITION", payload: updated })
    } else {
      // Mode ajout
      const meal: Meal = {
        id: generateId(),
        name: newMeal.name!,
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
    }

    setShowMealForm(false)
    setEditingMeal(null)
    setNewMeal({ name: "", time: "12:00", calories: 0, protein: 0, carbs: 0, fats: 0 })
  }

  const startEditMeal = (meal: Meal) => {
    setEditingMeal(meal)
    setNewMeal({
      name: meal.name,
      time: meal.time,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fats: meal.fats,
    })
    setShowMealForm(true)
  }

  const cancelEditMeal = () => {
    setEditingMeal(null)
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

  // Statistiques - Ne compter QUE les entraînements passés ET complétés
  const today = getToday()
  const last30DaysWorkouts = state.workoutSessions.filter((w) => {
    const workoutDate = new Date(w.date)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    // Ne compter que les entraînements passés (ou aujourd'hui) ET complétés
    return workoutDate >= thirtyDaysAgo && w.date <= today && w.completed
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
        <h1 className="text-2xl font-bold tracking-tight">Sport & Nutrition</h1>
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="workouts">
            <Dumbbell className="mr-2 h-4 w-4" />
            Entraînements
          </TabsTrigger>
          <TabsTrigger value="programs">
            <Calendar className="mr-2 h-4 w-4" />
            Programmes
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
                    const workouts = getWorkoutForDate(dateStr)
                    const isToday = dateStr === getToday()
                    
                    return (
                      <div
                        key={index}
                        className={`
                          min-h-28 p-2 border-t border-r relative hover:bg-accent/50 transition-colors
                          ${!day.isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""}
                          ${isToday ? "bg-primary/5 ring-2 ring-primary ring-inset" : ""}
                          ${workouts.length > 0 ? "bg-green-50 dark:bg-green-950/20" : ""}
                        `}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm font-semibold">
                            {day.date.getDate()}
                          </div>
                          {isToday && (
                            <Badge variant="default" className="text-xs px-1.5 py-0 h-5">
                              Aujourd'hui
                            </Badge>
                          )}
                        </div>
                        {workouts.length > 0 && (
                          <div className="space-y-1 max-h-20 overflow-y-auto">
                            {workouts.map((workout) => (
                              <div
                                key={workout.id}
                                className="group relative"
                              >
                                <div className={`text-xs px-1 py-0.5 rounded flex items-center gap-1 ${
                                  workout.completed
                                    ? "bg-green-500/20 text-green-700 dark:text-green-300 line-through"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                }`}>
                                  <span 
                                    className="truncate flex-1 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      editWorkout(workout)
                                    }}
                                  >
                                    {workout.type === "other" && workout.customType ? workout.customType : activityTypeLabels[workout.type]}
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    <CheckCircle2
                                      className={`h-3 w-3 flex-shrink-0 cursor-pointer hover:scale-110 transition-transform ${
                                        workout.completed ? "text-green-600" : "text-muted-foreground hover:text-green-600"
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleWorkoutCompletion(workout)
                                      }}
                                    />
                                    <Trash2
                                      className="h-3 w-3 flex-shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 hover:scale-110 transition-all text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (confirm("Supprimer cet entraînement ?")) {
                                          deleteWorkout(workout.id)
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground px-1">
                                  {workout.duration} min
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute bottom-1 right-1 h-6 w-6 opacity-50 hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
                          onClick={(e) => {
                            e.stopPropagation()
                            setNewWorkout({
                              ...newWorkout,
                              date: dateStr,
                            })
                            setEditingWorkout(null)
                            setShowWorkoutForm(true)
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Dialog pour ajout/édition */}
              <Dialog open={showWorkoutForm} onOpenChange={(open) => {
                if (!open) setEditingWorkout(null)
                setShowWorkoutForm(open)
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingWorkout ? "Modifier l'entraînement" : "Ajouter un entraînement"}</DialogTitle>
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
                    {editingWorkout && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          deleteWorkout(editingWorkout.id)
                          setShowWorkoutForm(false)
                          setEditingWorkout(null)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => {
                      setShowWorkoutForm(false)
                      setEditingWorkout(null)
                    }}>
                      Annuler
                    </Button>
                    <Button onClick={addWorkout}>{editingWorkout ? "Enregistrer" : "Ajouter"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Programmes */}
        <TabsContent value="programs" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Programmes d'entraînement</CardTitle>
                  <CardDescription>Créez des programmes récurrents et générez automatiquement vos séances</CardDescription>
                </div>
                <Button onClick={() => setShowProgramForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau programme
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {state.workoutPrograms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Aucun programme d'entraînement</p>
                  <p className="text-sm">Créez votre premier programme pour organiser vos séances</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {state.workoutPrograms.map((program) => (
                    <Card key={program.id} className={program.active ? "border-green-500" : ""}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{program.name}</CardTitle>
                            {program.description && (
                              <CardDescription>{program.description}</CardDescription>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant={program.active ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                dispatch({
                                  type: "UPDATE_WORKOUT_PROGRAM",
                                  payload: { ...program, active: !program.active },
                                })
                              }}
                            >
                              {program.active ? "Actif" : "Inactif"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProgramId(program.id)
                                setShowApplyDialog(true)
                              }}
                            >
                              Appliquer
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Supprimer ce programme ? Toutes les séances générées seront également supprimées.")) {
                                  // Supprimer toutes les séances liées au programme
                                  const linkedWorkouts = state.workoutSessions.filter((w) => w.programId === program.id)
                                  linkedWorkouts.forEach((workout) => {
                                    // Supprimer la mission associée si elle existe
                                    if (workout.missionId) {
                                      dispatch({ type: "DELETE_MISSION", payload: workout.missionId })
                                    }
                                    // Supprimer le workout
                                    dispatch({ type: "DELETE_WORKOUT", payload: workout.id })
                                  })
                                  
                                  // Supprimer le programme
                                  dispatch({ type: "DELETE_WORKOUT_PROGRAM", payload: program.id })
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{program.sessions.length} séances par semaine</span>
                            {program.autoCreateMissions && (
                              <span className="ml-4 text-green-600">• Missions automatiques</span>
                            )}
                          </div>
                          <div className="grid grid-cols-7 gap-2 mt-4">
                            {DAYS_ORDER.map((day, index) => {
                              const dayOfWeek = DAYS_VALUES[index]
                              const session = program.sessions.find((s) => s.dayOfWeek === dayOfWeek)
                              return (
                                <div
                                  key={index}
                                  className={`p-2 rounded text-center text-xs ${
                                    session
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  <div className="font-semibold">{day}</div>
                                  {session && (
                                    <>
                                      {session.time && <div className="text-xs opacity-80">{session.time}</div>}
                                      <div className="mt-1 truncate">
                                        {session.type === "other" && session.customType
                                          ? session.customType
                                          : activityTypeLabels[session.type]}
                                      </div>
                                      <div>{session.duration}min</div>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
              {/* Saisie rapide */}
              <div className="space-y-3">
                <h4 className="font-medium">Saisie rapide</h4>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setNewMeal({
                        name: "Petit-déjeuner",
                        time: "08:00",
                        calories: 350,
                        protein: 15,
                        carbs: 45,
                        fats: 12
                      })
                      setShowMealForm(true)
                    }}
                  >
                    🥐 Petit-déj
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setNewMeal({
                        name: "Déjeuner",
                        time: "12:30",
                        calories: 550,
                        protein: 25,
                        carbs: 60,
                        fats: 18
                      })
                      setShowMealForm(true)
                    }}
                  >
                    🍽️ Déjeuner
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setNewMeal({
                        name: "Collation 16h",
                        time: "16:00", 
                        calories: 200,
                        protein: 8,
                        carbs: 25,
                        fats: 8
                      })
                      setShowMealForm(true)
                    }}
                  >
                    🍎 16h
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setNewMeal({
                        name: "Dîner",
                        time: "19:30",
                        calories: 500,
                        protein: 30,
                        carbs: 40,
                        fats: 20
                      })
                      setShowMealForm(true)
                    }}
                  >
                    🍖 Dîner
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setNewMeal({
                        name: "Œufs bacon",
                        time: "08:00",
                        calories: 420,
                        protein: 28,
                        carbs: 5,
                        fats: 32
                      })
                      setShowMealForm(true)
                    }}
                  >
                    🥓 Œufs bacon
                  </Button>
                </div>
              </div>
              
              {showMealForm && (
                <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                  <h3 className="font-semibold">{editingMeal ? "Modifier le repas" : "Ajouter un repas"}</h3>
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
                    <Button onClick={saveMeal}>{editingMeal ? "Enregistrer" : "Ajouter"}</Button>
                    <Button variant="outline" onClick={cancelEditMeal}>
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
                  <p className="text-center text-muted-foreground py-8">
                    Aucun repas enregistré aujourd'hui
                  </p>
                ) : null}
              </div>
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

          {/* Recommandations santé */}
          <Card>
            <CardHeader>
              <CardTitle>Recommandations santé</CardTitle>
              <CardDescription>Pour optimiser vos performances et récupération</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted border">
                  <div className="flex items-center gap-3">
                    <Droplets className="h-10 w-10" />
                    <div>
                      <p className="font-semibold">Hydratation</p>
                      {recommendedHydration ? (
                        <p className="text-2xl font-bold">{recommendedHydration.min}–{recommendedHydration.max} L</p>
                      ) : (
                        <p className="text-2xl font-bold">2–2,5 L</p>
                      )}
                      <p className="text-sm text-muted-foreground">par jour</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted border">
                  <div className="flex items-center gap-3">
                    <Moon className="h-10 w-10" />
                    <div>
                      <p className="font-semibold">Sommeil</p>
                      <p className="text-2xl font-bold">7–9 h</p>
                      <p className="text-sm text-muted-foreground">Essentiel pour la récupération</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Dialog open={showProfileForm && !!state.fitnessProfile} onOpenChange={setShowProfileForm}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Modifier mon profil</DialogTitle>
                <DialogDescription>Mettez à jour vos informations pour des recommandations personnalisées</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowProfileForm(false)}>
                  Annuler
                </Button>
                <Button onClick={saveProfile}>Enregistrer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* Dialog pour créer un programme */}
      <Dialog open={showProgramForm} onOpenChange={setShowProgramForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un programme d'entraînement</DialogTitle>
            <DialogDescription>
              Définissez vos séances hebdomadaires et générez-les automatiquement
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Nom du programme *</Label>
                <Input
                  placeholder="Ex: Programme Full Body"
                  value={newProgram.name}
                  onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  placeholder="Ex: 4 séances par semaine"
                  value={newProgram.description}
                  onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoMissions"
                  checked={newProgram.autoCreateMissions}
                  onChange={(e) =>
                    setNewProgram({ ...newProgram, autoCreateMissions: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="autoMissions" className="cursor-pointer">
                  Créer automatiquement les missions du jour
                </Label>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-4">Séances de la semaine</h4>
              
              {newProgram.sessions && newProgram.sessions.length > 0 && (
                <div className="space-y-2 mb-4">
                  {newProgram.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="font-semibold min-w-16">
                          {DAYS_ORDER[DAYS_VALUES.indexOf(session.dayOfWeek)] || "?"}
                        </div>
                        <div>
                          <div className="font-medium">
                            {session.type === "other" && session.customType
                              ? session.customType
                              : activityTypeLabels[session.type]}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {session.time && `${session.time} • `}{session.duration} min • {session.intensity === "light" ? "Légère" : session.intensity === "moderate" ? "Modérée" : "Intense"}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeProgramSession(session.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4 p-4 rounded-lg border bg-background">
                <h5 className="font-medium">Ajouter une séance</h5>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Jour de la semaine *</Label>
                    <Select
                      value={String(newProgramSession.dayOfWeek)}
                      onValueChange={(value) =>
                        setNewProgramSession({ ...newProgramSession, dayOfWeek: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Lundi</SelectItem>
                        <SelectItem value="2">Mardi</SelectItem>
                        <SelectItem value="3">Mercredi</SelectItem>
                        <SelectItem value="4">Jeudi</SelectItem>
                        <SelectItem value="5">Vendredi</SelectItem>
                        <SelectItem value="6">Samedi</SelectItem>
                        <SelectItem value="0">Dimanche</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Type d'activité *</Label>
                    <Select
                      value={newProgramSession.type}
                      onValueChange={(value) =>
                        setNewProgramSession({ ...newProgramSession, type: value as ActivityType })
                      }
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
                </div>

                {newProgramSession.type === "other" && (
                  <div>
                    <Label>Nom du sport</Label>
                    <Input
                      placeholder="Ex: Tennis, Natation..."
                      value={newProgramSession.customType || ""}
                      onChange={(e) =>
                        setNewProgramSession({ ...newProgramSession, customType: e.target.value })
                      }
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Durée (min) *</Label>
                    <Input
                      type="number"
                      value={newProgramSession.duration}
                      onChange={(e) =>
                        setNewProgramSession({
                          ...newProgramSession,
                          duration: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label>Heure (facultatif)</Label>
                    <Input
                      type="time"
                      value={newProgramSession.time || ""}
                      onChange={(e) =>
                        setNewProgramSession({ ...newProgramSession, time: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Intensité</Label>
                  <Select
                    value={newProgramSession.intensity}
                    onValueChange={(value) =>
                      setNewProgramSession({ ...newProgramSession, intensity: value as any })
                    }
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

                <div>
                  <Label>Notes</Label>
                  <Input
                    placeholder="Ex: Upper body, Cardio..."
                    value={newProgramSession.notes || ""}
                    onChange={(e) =>
                      setNewProgramSession({ ...newProgramSession, notes: e.target.value })
                    }
                  />
                </div>

                <Button onClick={addProgramSession} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter cette séance
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProgramForm(false)}>
              Annuler
            </Button>
            <Button
              onClick={saveProgram}
              disabled={!newProgram.name || !newProgram.sessions || newProgram.sessions.length === 0}
            >
              Créer le programme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pour appliquer un programme */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appliquer le programme</DialogTitle>
            <DialogDescription>
              Choisissez la période pour laquelle générer les séances
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => {
                  setApplyWeeks(4)
                }}
              >
                <div className="text-left">
                  <div className="font-semibold">1 mois (4 semaines)</div>
                  <div className="text-sm text-muted-foreground">Idéal pour démarrer</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => {
                  setApplyWeeks(12)
                }}
              >
                <div className="text-left">
                  <div className="font-semibold">3 mois (12 semaines)</div>
                  <div className="text-sm text-muted-foreground">Programme complet</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => {
                  const today = new Date()
                  const endOfYear = new Date(today.getFullYear(), 11, 31)
                  const diffTime = Math.abs(endOfYear.getTime() - today.getTime())
                  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7))
                  setApplyWeeks(diffWeeks)
                }}
              >
                <div className="text-left">
                  <div className="font-semibold">Jusqu'à fin d'année</div>
                  <div className="text-sm text-muted-foreground">
                    {(() => {
                      const today = new Date()
                      const endOfYear = new Date(today.getFullYear(), 11, 31)
                      const diffTime = Math.abs(endOfYear.getTime() - today.getTime())
                      const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7))
                      return `${diffWeeks} semaines`
                    })()}
                  </div>
                </div>
              </Button>

              <div className="pt-2">
                <Label>Ou nombre de semaines personnalisé</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    min="1"
                    max="52"
                    value={applyWeeks}
                    onChange={(e) => setApplyWeeks(parseInt(e.target.value) || 4)}
                    placeholder="Nombre de semaines"
                  />
                  <span className="text-sm text-muted-foreground self-center">semaines</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (selectedProgramId) {
                  applyProgram(selectedProgramId, applyWeeks)
                  setShowApplyDialog(false)
                  setSelectedProgramId(null)
                }
              }}
            >
              Générer les séances
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
