"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/lib/store-api"
import { generateId, getToday, toLocalDateString } from "@/lib/helpers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MonthCalendar, MonthNav, monthLabel, shiftMonth } from "@/components/month-calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Dumbbell, Plus, Trash2, TrendingUp, Trophy, User, Calendar as CalendarIcon, Droplets, Moon, Calendar, Clock, CheckCircle2, Pencil } from "lucide-react"
import type { WorkoutSession, PersonalRecord, FitnessProfile, ActivityType, FitnessGoal, WorkoutProgram, WorkoutProgramSession, Mission, TimeFrame, Priority, TaskStatus } from "@/lib/types"
import { goalLabels, getEffectiveMacros, hasCustomMacros as hasCustomMacrosFor } from "@/lib/nutrition"
import { Lottie } from "@/components/lottie"

// Ordre des jours : Lundi à Dimanche (dimanche en dernier)
const DAYS_ORDER = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
const DAYS_VALUES = [1, 2, 3, 4, 5, 6, 0] // dayOfWeek correspondant (dimanche = 0 en dernier)
const DAYS_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
// Nombre de semaines générées automatiquement lorsqu'on réactive un programme
const DEFAULT_AUTO_APPLY_WEEKS = 4


export function SportPage() {
  const {
    state,
    dispatch,
    updateFitnessProfile,
    addWorkoutProgram,
    updateWorkoutProgram,
    deleteWorkoutProgram,
    addMission,
    addWorkout: persistAddWorkout,
    updateWorkout: persistUpdateWorkout,
    deleteWorkout: persistDeleteWorkout,
  } = useApp()
  const [activeTab, setActiveTab] = useState("workouts")
  const [showWorkoutForm, setShowWorkoutForm] = useState(false)
  const [showPRForm, setShowPRForm] = useState(false)
  const [showProfileForm, setShowProfileForm] = useState(!state.fitnessProfile)
  const [showProgramForm, setShowProgramForm] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null)
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [applyWeeks, setApplyWeeks] = useState(4)
  const [selectedDate, setSelectedDate] = useState(getToday())

  const isMobile = useIsMobile();

  // useEffect(() => {
  //   setIsMobile(window.innerWidth < 900); // breakpoint sm
  // }, []);

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

  const effectiveMacros = getEffectiveMacros(state.fitnessProfile)
  const hasCustomMacros = hasCustomMacrosFor(state.fitnessProfile)

  // Calcul de l'hydratation recommandée (30-35ml par kg)
  const calculateHydration = (profile: FitnessProfile) => {
    const baseHydration = profile.weight * 0.035 // 35ml par kg
    const min = Math.round((profile.weight * 0.030) * 10) / 10 // 30ml par kg
    const max = Math.round((profile.weight * 0.035) * 10) / 10 // 35ml par kg
    return { min, max }
  }

  const recommendedHydration = state.fitnessProfile ? calculateHydration(state.fitnessProfile) : null

  // Fonctions calendrier pour workouts
  const getMonthWorkouts = () => {
    // Comparaison sur "AAAA-MM" : new Date("AAAA-MM-JJ") serait lu en UTC
    const month = selectedDate.slice(0, 7)
    return state.workoutSessions.filter((workout) => workout.date.slice(0, 7) === month)
  }


  const getWorkoutForDate = (dateStr: string) => {
    return state.workoutSessions.filter((workout) => workout.date === dateStr)
  }


  const saveWorkout = async () => {
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
      await persistUpdateWorkout(updated)
      setEditingWorkout(null)
    } else {
      // Mode ajout
      const workout: Omit<WorkoutSession, 'id'> = {
        date: newWorkout.date || getToday(),
        type: newWorkout.type as ActivityType,
        customType: newWorkout.type === "other" ? newWorkout.customType : undefined,
        duration: newWorkout.duration,
        notes: newWorkout.notes,
        intensity: newWorkout.intensity || "moderate",
      }
      await persistAddWorkout(workout)
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

  const deleteWorkout = async (id: string) => {
    await persistDeleteWorkout(id)
  }

  const toggleWorkoutCompletion = async (workout: WorkoutSession) => {
    await persistUpdateWorkout({ ...workout, completed: !workout.completed })
  }

  // Gestion des programmes
  const generateProgramWorkouts = (program: WorkoutProgram, startDate: string, weeks: number = 4) => {
    const workouts: Omit<WorkoutSession, 'id'>[] = []
    const start = new Date(startDate)

    for (let week = 0; week < weeks; week++) {
      program.sessions.forEach((session) => {
        // Trouver la prochaine occurrence du jour de la semaine
        const targetDay = session.dayOfWeek // 1=Lun, 2=Mar, 3=Mer, 4=Jeu, 5=Ven, 6=Sam, 0=Dim

        // Calculer le début de la semaine courante (lundi)
        const weekStart = new Date(start)
        const currentDay = start.getDay() // 0=Dim, 1=Lun, 2=Mar, etc.
        const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay
        weekStart.setDate(start.getDate() + daysToMonday + (week * 7))

        // Calculer le jour cible dans cette semaine
        const date = new Date(weekStart)
        if (targetDay === 0) {
          // Dimanche = fin de semaine (lundi + 6)
          date.setDate(weekStart.getDate() + 6)
        } else {
          // Lundi à Samedi (lundi + targetDay - 1)
          date.setDate(weekStart.getDate() + targetDay - 1)
        }

        const workout: Omit<WorkoutSession, 'id'> = {
          date: toLocalDateString(date),
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

  const applyProgram = async (programId: string, weeks: number = 4, activeOverride?: boolean) => {
    const program = state.workoutPrograms.find((p) => p.id === programId)
    if (!program) return
    const isActive = activeOverride ?? program.active

    const workouts = generateProgramWorkouts(program, getToday(), weeks)

    // Filtrer les workouts qui n'existent pas déjà (éviter les doublons)
    const newWorkouts = workouts.filter((workout) => {
      // Vérifier s'il existe déjà un workout du même programme à la même date
      const existingWorkout = state.workoutSessions.find(
        (w) => w.programId === program.id && w.date === workout.date
      )
      return !existingWorkout
    })

    // Ajouter uniquement les nouveaux workouts, en persistant chacun
    const createdWorkouts: WorkoutSession[] = []
    for (const workout of newWorkouts) {
      const created = await persistAddWorkout(workout)
      createdWorkouts.push(created)
    }

    // Créer les missions si activé ET si le programme est actif
    if (program.autoCreateMissions && isActive) {
      for (const workout of createdWorkouts) {
        const mission = state.missions.find(
          (m) => m.timeFrame === "day" && m.dueDate === workout.date && m.title.includes(program.name)
        )
        if (!mission) {
          const newMission = await addMission({
            title: `${program.name} - ${activityTypeLabels[workout.type]}`,
            description: `Séance de ${workout.duration} min`,
            timeFrame: "day" as TimeFrame,
            priority: "medium" as Priority,
            status: "todo" as TaskStatus,
            tasks: [],
            dueDate: workout.date,
          })

          // Lier le workout à la mission
          await persistUpdateWorkout({ ...workout, missionId: newMission.id })
        }
      }
    }
  }

  const toggleProgramActive = async (program: WorkoutProgram) => {
    const nextActive = !program.active
    await updateWorkoutProgram({ ...program, active: nextActive })

    // Réactiver un programme doit régénérer ses séances à venir sans action supplémentaire
    if (nextActive) {
      await applyProgram(program.id, DEFAULT_AUTO_APPLY_WEEKS, true)
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

  if (showProfileForm && !state.fitnessProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Dumbbell className="h-8 w-8" />
            Sport
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
                  <SelectItem value="weight_loss">Perte de poids</SelectItem>
                  <SelectItem value="muscle_gain">Prise de masse</SelectItem>
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
                  <SelectItem value="very_active">Très actif (2x par jour)</SelectItem>
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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Sport</h1>
        <p className="text-sm text-muted-foreground">Suivez vos entraînements et vos performances</p>
      </div>

      {/* Stats globales */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 @2xl/main:grid-cols-4">
        <Card className="py-2 gap-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Entraînements (30j)</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 text-center">
            <div className="text-3xl font-bold">{totalWorkouts}</div>
            <p className="text-xs text-muted-foreground">{Math.round(totalDuration / 60)}h totales</p>
          </CardContent>
        </Card>

        <Card className="py-2 gap-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Durée moyenne</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 text-center">
            <div className="text-3xl font-bold">{avgDuration}min</div>
            <p className="text-xs text-muted-foreground">Par session</p>
          </CardContent>
        </Card>

        <Card className="py-2 gap-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Personal Records</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 text-center">
            <div className="text-3xl font-bold">{state.personalRecords.length}</div>
            <p className="text-xs text-muted-foreground">Performances</p>
          </CardContent>
        </Card>

        <Card className="py-2 gap-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Poids actuel</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 text-center">
            <div className="text-3xl font-bold">{state.fitnessProfile?.weight || "-"} kg</div>
            {state.fitnessProfile?.targetWeight && (
              <p className="text-xs text-muted-foreground">
                Objectif: {state.fitnessProfile.targetWeight} kg
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList data-tour="sport-tabs" className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="workouts" className="flex-col sm:flex-row gap-1 py-2 text-xs sm:text-sm">
            <Dumbbell className="h-4 w-4" />
            <span className="hidden sm:inline">Entraînements</span>
            <span className="sm:hidden">Sport</span>
          </TabsTrigger>
          <TabsTrigger value="programs" className="flex-col sm:flex-row gap-1 py-2 text-xs sm:text-sm">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Programmes</span>
            <span className="sm:hidden">Prog.</span>
          </TabsTrigger>
          <TabsTrigger value="prs" className="flex-col sm:flex-row gap-1 py-2 text-xs sm:text-sm">
            <Trophy className="h-4 w-4" />
            Records
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex-col sm:flex-row gap-1 py-2 text-xs sm:text-sm">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
        </TabsList>

        {/* Onglet Entraînements */}
        <TabsContent value="workouts" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle>Calendrier d'entraînement</CardTitle>
                </div>
                <MonthNav
                  label={monthLabel(selectedDate)}
                  onPrev={() => setSelectedDate(shiftMonth(selectedDate, -1))}
                  onNext={() => setSelectedDate(shiftMonth(selectedDate, 1))}
                  onToday={() => setSelectedDate(getToday())}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <MonthCalendar
                day={selectedDate}
                dayClassName={(day) => getWorkoutForDate(day.key).length > 0 && "bg-green-50 dark:bg-green-950/20"}
                renderDay={(day) => {
                  const dateStr = day.key
                  const workouts = getWorkoutForDate(dateStr)
                  return (
                    <>
                        {workouts.length > 0 && (
                          <div className="min-w-0 space-y-1 max-h-20 overflow-y-auto">
                            {workouts.map((workout) => (
                              <div
                                key={workout.id}
                                className="group relative"
                              >
                                <div className={`text-xs px-1 py-0.5 rounded flex min-w-0 items-center gap-1 ${
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
                                  <div className="hidden items-center gap-0.5 @min-[5rem]:flex">
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
                                <div className="truncate text-xs text-muted-foreground px-1">
                                  {workout.duration} min
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Ajouter un entraînement"
                          className="absolute bottom-1 right-1 h-6 w-6 opacity-0 group-hover/day:opacity-100 focus-visible:opacity-100 transition-opacity"
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
                          <Plus className="size-5" />
                        </Button>
                    </>
                  )
                }}
              />

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
                    <Button onClick={saveWorkout}>{editingWorkout ? "Enregistrer" : "Ajouter"}</Button>
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
                  <CardDescription className="text-xs sm:text-sm">Créez des programmes récurrents et générez automatiquement vos séances</CardDescription>
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
                  <Lottie src="/animations/utilisees/chat qui joue.json" adaptive="ink" className="mx-auto mb-2 h-32 w-72 max-w-full text-foreground" />
                  <p>Pas de programme de sport ?! Hmmmm </p>
                  <p className="text-sm">Créez votre premier programme pour organiser vos séances</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {state.workoutPrograms.map((program) => (
                    <Card key={program.id} className={program.active ? "border-green-500" : ""}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm sm:text-lg">{program.name}</CardTitle>
                            {program.description && (
                              <CardDescription>{program.description}</CardDescription>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* DESKTOP */}
                            <div className="hidden sm:flex gap-2">
                              <Button
                                variant={program.active ? "default" : "outline"}
                                size="sm"
                                onClick={() => toggleProgramActive(program)}
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
                                    const linkedWorkouts = state.workoutSessions.filter((w) => w.programId === program.id)
                                    linkedWorkouts.forEach((workout) => {
                                      if (workout.missionId) {
                                        dispatch({ type: "DELETE_MISSION", payload: workout.missionId })
                                      }
                                      dispatch({ type: "DELETE_WORKOUT", payload: workout.id })
                                    })
                                    dispatch({ type: "DELETE_WORKOUT_PROGRAM", payload: program.id })
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* MOBILE */}
                            <div className="sm:hidden">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    ⋮
                                  </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => toggleProgramActive(program)}
                                  >
                                    {program.active ? "Désactiver" : "Activer"}
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedProgramId(program.id)
                                      setShowApplyDialog(true)
                                    }}
                                  >
                                    Appliquer
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => {
                                      if (confirm("Supprimer ce programme ? Toutes les séances générées seront également supprimées.")) {
                                        const linkedWorkouts = state.workoutSessions.filter((w) => w.programId === program.id)
                                        linkedWorkouts.forEach((workout) => {
                                          if (workout.missionId) {
                                            dispatch({ type: "DELETE_MISSION", payload: workout.missionId })
                                          }
                                          dispatch({ type: "DELETE_WORKOUT", payload: workout.id })
                                        })
                                        dispatch({ type: "DELETE_WORKOUT_PROGRAM", payload: program.id })
                                      }
                                    }}
                                  >
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{program.sessions.length} séances par semaine</span>
                            {program.autoCreateMissions && (
                              <span className="ml-4 text-green-600">• Objectifs automatiques</span>
                            )}
                          </div>
                          <div className="grid grid-cols-7 gap-2 mt-4">
                            {DAYS_ORDER.map((day, index) => {
                              const dayOfWeek = DAYS_VALUES[index]
                              const session = program.sessions.find((s) => s.dayOfWeek === dayOfWeek)
                              return (
                                <div
                                  key={index}
                                  className={`p-1 sm:p-2 rounded text-center text-xs ${
                                    session
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  <div className="font-semibold">{day}</div>
                                  {session && !isMobile &&(
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

              <div className="grid gap-4 @2xl/main:grid-cols-2">
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
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setShowProfileForm(true)}>
                  <Pencil className="size-4" />
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

                  {effectiveMacros && (
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          Besoins nutritionnels quotidiens
                          {hasCustomMacros && <Badge variant="secondary">Personnalisé</Badge>}
                        </h4>
                        <span className="text-xs text-muted-foreground">Modifiables dans Nutrition</span>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Calories</p>
                          <p className="text-lg font-bold">{effectiveMacros.calories}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Protéines</p>
                          <p className="text-lg font-bold">{effectiveMacros.protein}g</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Glucides</p>
                          <p className="text-lg font-bold">{effectiveMacros.carbs}g</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Lipides</p>
                          <p className="text-lg font-bold">{effectiveMacros.fats}g</p>
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
              <div className="grid @2xl/main:grid-cols-2 gap-4">
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
            <DialogContent className="max-w-[90vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                      <SelectItem value="weight_loss">Perte de poids</SelectItem>
                      <SelectItem value="muscle_gain">Prise de masse</SelectItem>
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
                      <SelectItem value="very_active">Très actif</SelectItem>
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
        <DialogContent className="max-w-[90vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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
                  Créer automatiquement les objectifs du jour
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
