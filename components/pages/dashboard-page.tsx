"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  CheckCircle2,
  Circle,
  Clock,
  Target,
  TrendingUp,
  Lightbulb,
  Heart,
  X,
  ChevronRight,
  Flame,
  GripVertical,
  Plus,
  Settings,
  RotateCcw,
  Moon,
  Bed,
  Dumbbell,
  ArrowLeftRight,
  ArrowUpDown,
  Trash2,
  Edit3,
} from "lucide-react"
import { useApp } from "@/lib/store-api"
import { getToday, formatDateFr, calculateStreak, generateId } from "@/lib/helpers"
import type { NavPage } from "@/components/app-sidebar"
import type { WidgetType, DashboardWidget } from "@/lib/types"
import { cn } from "@/lib/utils"

interface DashboardPageProps {
  onNavigate: (page: NavPage) => void
}

const WIDGET_LABELS: Record<WidgetType, { label: string; description: string; icon: any; category?: string }> = {
  "routine-progress": { label: "Routine du jour", description: "Progression de la routine matinale", icon: CheckCircle2, category: "Routine" },
  "routine-streak": { label: "Série routine", description: "Nombre de jours consécutifs", icon: Flame, category: "Routine" },
  "routine-list": { label: "Liste routine", description: "Actions de la routine matinale", icon: CheckCircle2, category: "Routine" },
  
  "night-routine-progress": { label: "Routine du soir", description: "Progression routine du soir", icon: Moon, category: "Routine" },
  "night-routine-list": { label: "Liste routine soir", description: "Actions de la routine du soir", icon: Moon, category: "Routine" },
  
  "missions-stats": { label: "Missions", description: "Statistiques des missions", icon: Target, category: "Missions" },
  "today-missions": { label: "Missions du jour", description: "Missions à faire aujourd'hui", icon: Target, category: "Missions" },
  "week-missions": { label: "Missions semaine", description: "Missions de la semaine", icon: Target, category: "Missions" },
  "mission-priority-high": { label: "Missions urgentes", description: "Missions haute priorité", icon: Target, category: "Missions" },
  
  "tasks-stats": { label: "Tâches", description: "Statistiques des tâches", icon: CheckCircle2, category: "Tâches" },
  "tasks-today": { label: "Tâches du jour", description: "Tâches à faire aujourd'hui", icon: CheckCircle2, category: "Tâches" },
  "tasks-urgent": { label: "Tâches urgentes", description: "Tâches avec deadline proche", icon: Clock, category: "Tâches" },
  
  "projects-stats": { label: "Projets actifs", description: "Nombre de projets en cours", icon: TrendingUp, category: "Projets" },
  "active-projects": { label: "Projets en cours", description: "Liste des projets actifs", icon: TrendingUp, category: "Projets" },
  "project-progress": { label: "Progression projet", description: "Progression détaillée des projets", icon: TrendingUp, category: "Projets" },
  
  "sleep-summary": { label: "Sommeil", description: "Résumé du sommeil", icon: Bed, category: "Sommeil" },
  "sleep-bedtime-cycles": { label: "Heure de coucher", description: "Heure pour 6 cycles de sommeil", icon: Bed, category: "Sommeil" },
  "sleep-quality-avg": { label: "Qualité sommeil", description: "Qualité moyenne du sommeil", icon: Bed, category: "Sommeil" },
  "sleep-duration-avg": { label: "Durée sommeil", description: "Durée moyenne par nuit", icon: Bed, category: "Sommeil" },
  "sleep-last-night": { label: "Nuit dernière", description: "Détails de la dernière nuit", icon: Bed, category: "Sommeil" },
  
  "workout-summary": { label: "Sport", description: "Résumé des entraînements", icon: Dumbbell, category: "Sport" },
  "workout-week-count": { label: "Séances semaine", description: "Nombre d'entraînements cette semaine", icon: Dumbbell, category: "Sport" },
  "workout-last-session": { label: "Dernier entraînement", description: "Détails de la dernière séance", icon: Dumbbell, category: "Sport" },
  "workout-calories": { label: "Calories brûlées", description: "Calories de la semaine", icon: Dumbbell, category: "Sport" },
  
  "nutrition-daily": { label: "Nutrition du jour", description: "Apports nutritionnels aujourd'hui", icon: Target, category: "Nutrition" },
  "nutrition-macros": { label: "Macros", description: "Répartition protéines/glucides/lipides", icon: Target, category: "Nutrition" },
}

const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: "1", type: "routine-progress", enabled: true, order: 0, width: 1, height: 1 },
  { id: "2", type: "missions-stats", enabled: true, order: 1, width: 1, height: 1 },
  { id: "3", type: "tasks-stats", enabled: true, order: 2, width: 1, height: 1 },
  { id: "4", type: "projects-stats", enabled: true, order: 3, width: 1, height: 1 },
  { id: "5", type: "routine-list", enabled: true, order: 4, width: 2, height: 1 },
  { id: "6", type: "today-missions", enabled: true, order: 5, width: 2, height: 1 },
  { id: "7", type: "week-missions", enabled: true, order: 6, width: 2, height: 1 },
  { id: "8", type: "active-projects", enabled: true, order: 7, width: 2, height: 1 },
]

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { state, dispatch, isLoading, updateDashboardWidgets } = useApp()
  const today = getToday()
  const [showWidgetConfig, setShowWidgetConfig] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null)
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null)
  const [editingWidget, setEditingWidget] = useState<string | null>(null)
  const [editWidgetType, setEditWidgetType] = useState<WidgetType | null>(null)
  const [resizingWidget, setResizingWidget] = useState<string | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [resizeType, setResizeType] = useState<'width' | 'height' | 'both' | null>(null)

  // Initialize widgets from store - only set defaults on first load if dashboardWidgets is undefined
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    // If dashboardWidgets is undefined (never set), use defaults
    if (state.dashboardWidgets === undefined) {
      return DEFAULT_DASHBOARD_WIDGETS
    }
    // If it's an empty array (user deleted all), keep it empty
    return state.dashboardWidgets
  })

  // Sync widgets with store data - only update when store changes, don't reset to defaults
  useEffect(() => {
    // If dashboardWidgets exists in state (even if empty), use it
    if (state.dashboardWidgets !== undefined) {
      setWidgets(state.dashboardWidgets)
      return
    }

    // Only seed defaults on first load if dashboardWidgets is still undefined
    if (!isLoading && state.dashboardWidgets === undefined) {
      updateDashboardWidgets(DEFAULT_DASHBOARD_WIDGETS)
      setWidgets(DEFAULT_DASHBOARD_WIDGETS)
    }
  }, [state.dashboardWidgets, isLoading, updateDashboardWidgets])

  const enabledWidgets = useMemo(() => {
    return widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order)
  }, [widgets])

  const todayLogs = useMemo(() => {
    return state.routineLogs.filter((l) => l.date === today)
  }, [state.routineLogs, today])

  const todayNightLogs = useMemo(() => {
    return state.nightRoutineLogs.filter((l) => l.date === today)
  }, [state.nightRoutineLogs, today])

  const routineProgress = useMemo(() => {
    const total = state.routineActions.length
    if (total === 0) return 0
    const completed = todayLogs.filter((l) => l.completed).length
    return Math.round((completed / total) * 100)
  }, [state.routineActions.length, todayLogs])

  const nightRoutineProgress = useMemo(() => {
    const total = state.nightRoutineActions.length
    if (total === 0) return 0
    const completed = todayNightLogs.filter((l) => l.completed).length
    return Math.round((completed / total) * 100)
  }, [state.nightRoutineActions.length, todayNightLogs])

  const todayMissions = useMemo(() => {
    return state.missions.filter((m) => {
      // Filtrer par date et statut
      if (m.timeFrame !== "day" || m.status === "done" || m.dueDate !== today) {
        return false
      }
      
      // Si la mission est liée à un workout, vérifier que le programme est actif
      const linkedWorkout = state.workoutSessions.find((w) => w.missionId === m.id)
      if (linkedWorkout?.programId) {
        const program = state.workoutPrograms.find((p) => p.id === linkedWorkout.programId)
        if (program && !program.active) {
          return false
        }
      }
      
      return true
    }).slice(0, 3)
  }, [state.missions, state.workoutSessions, state.workoutPrograms, today])

  const weekMissions = useMemo(() => {
    return state.missions.filter((m) => m.timeFrame === "week" && m.status !== "done").slice(0, 3)
  }, [state.missions])

  const activeProjects = useMemo(() => {
    return state.projects.filter((p) => !p.completedAt).slice(0, 3)
  }, [state.projects])

  const visibleInsight = useMemo(() => {
    return state.dailyInsights.find((i) => !i.hidden)
  }, [state.dailyInsights])

  const stats = useMemo(() => {
    const completedMissions = state.missions.filter((m) => m.status === "done").length
    const totalMissions = state.missions.length
    const completedTasks = state.tasks.filter((t) => t.status === "done").length
    const totalTasks = state.tasks.length

    // Sleep stats
    const recentSleepLogs = state.sleepLogs.slice(-7)
    const avgSleepDuration = recentSleepLogs.length > 0
      ? Math.round(recentSleepLogs.reduce((acc, log) => acc + log.duration, 0) / recentSleepLogs.length / 60)
      : 0

    const avgSleepQuality = recentSleepLogs.length > 0
      ? Math.round(recentSleepLogs.reduce((acc, log) => acc + log.quality, 0) / recentSleepLogs.length)
      : 0

    // Workout stats - Ne compter QUE les entraînements passés (ou aujourd'hui) ET complétés
    const weekWorkouts = state.workoutSessions.filter((w) => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const workoutDate = new Date(w.date)
      const today = new Date().toISOString().split("T")[0]
      return workoutDate >= weekAgo && w.date <= today && w.completed
    }).length

    return {
      missionsCompleted: completedMissions,
      missionsTotal: totalMissions,
      tasksCompleted: completedTasks,
      tasksTotal: totalTasks,
      projectsActive: state.projects.filter((p) => !p.completedAt).length,
      avgSleepHours: avgSleepDuration,
      avgSleepQuality: avgSleepQuality,
      weekWorkouts,
    }
  }, [state.missions, state.tasks, state.projects, state.sleepLogs, state.workoutSessions])

  const toggleRoutine = (actionId: string) => {
    const existingLog = todayLogs.find((l) => l.actionId === actionId)
    dispatch({
      type: "LOG_ROUTINE",
      payload: {
        id: existingLog?.id || generateId(),
        actionId,
        date: today,
        completed: !existingLog?.completed,
      },
    })
  }

  const getProjectProgress = (projectId: string) => {
    const projectTasks = state.tasks.filter((t) => t.projectId === projectId)
    if (projectTasks.length === 0) return 0
    const completed = projectTasks.filter((t) => t.status === "done").length
    return Math.round((completed / projectTasks.length) * 100)
  }

  const handleDragStart = (e: React.DragEvent, widgetId: string) => {
    setDraggedWidget(widgetId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, widgetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverWidget(widgetId)
  }

  const handleDragEnd = () => {
    setDraggedWidget(null)
    setDragOverWidget(null)
  }

  const handleDrop = async (e: React.DragEvent, targetWidgetId: string) => {
    e.preventDefault()

    if (!draggedWidget || draggedWidget === targetWidgetId) {
      setDraggedWidget(null)
      setDragOverWidget(null)
      return
    }

    const draggedIndex = widgets.findIndex((w) => w.id === draggedWidget)
    const targetIndex = widgets.findIndex((w) => w.id === targetWidgetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newWidgets = [...widgets]
    const [removed] = newWidgets.splice(draggedIndex, 1)
    newWidgets.splice(targetIndex, 0, removed)

    // Update order
    const updatedWidgets = newWidgets.map((w, idx) => ({ ...w, order: idx }))
    setWidgets(updatedWidgets)
    dispatch({ type: "UPDATE_DASHBOARD_WIDGETS", payload: updatedWidgets })
    await updateDashboardWidgets(updatedWidgets)

    setDraggedWidget(null)
    setDragOverWidget(null)
  }

  const toggleWidget = async (widgetId: string) => {
    const updatedWidgets = widgets.map((w) =>
      w.id === widgetId ? { ...w, enabled: !w.enabled } : w
    )
    setWidgets(updatedWidgets)
    dispatch({ type: "UPDATE_DASHBOARD_WIDGETS", payload: updatedWidgets })
    await updateDashboardWidgets(updatedWidgets)
  }

  const addWidget = async (type: WidgetType) => {
    const newWidget: DashboardWidget = {
      id: generateId(),
      type,
      enabled: true,
      order: widgets.length,
      width: 2,
      height: 1,
    }
    const updatedWidgets = [...widgets, newWidget]
    setWidgets(updatedWidgets)
    dispatch({ type: "UPDATE_DASHBOARD_WIDGETS", payload: updatedWidgets })
    await updateDashboardWidgets(updatedWidgets)
  }

  const handleResizeStart = (e: React.MouseEvent, widgetId: string, type: 'width' | 'height' | 'both') => {
    e.preventDefault()
    e.stopPropagation()
    const widget = widgets.find((w) => w.id === widgetId)
    if (!widget) return

    setResizingWidget(widgetId)
    setResizeType(type)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: widget.width,
      height: widget.height,
    })
  }

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingWidget || !resizeStart || !resizeType) return

    const deltaX = e.clientX - resizeStart.x
    const deltaY = e.clientY - resizeStart.y

    // Calcul plus précis et fluide : chaque 60px = 1 unité
    const columnWidth = 60
    const rowHeight = 60
    
    let newWidth = resizeStart.width
    let newHeight = resizeStart.height

    // Calculer la nouvelle largeur si on resize en largeur
    if (resizeType === 'width' || resizeType === 'both') {
      newWidth = Math.max(1, Math.min(4, resizeStart.width + Math.floor(deltaX / columnWidth))) as 1 | 2 | 3 | 4
    }

    // Calculer la nouvelle hauteur si on resize en hauteur
    if (resizeType === 'height' || resizeType === 'both') {
      newHeight = Math.max(1, Math.min(2, resizeStart.height + Math.floor(deltaY / rowHeight))) as 1 | 2
    }

    // Mise à jour instantanée
    const widget = widgets.find((w) => w.id === resizingWidget)
    if (widget && (newWidth !== widget.width || newHeight !== widget.height)) {
      const updatedWidgets = widgets.map((w) =>
        w.id === resizingWidget ? { ...w, width: newWidth as 1 | 2 | 3 | 4, height: newHeight as 1 | 2 } : w
      )
      setWidgets(updatedWidgets)
    }
  }

  const handleResizeEnd = async () => {
    if (resizingWidget) {
      dispatch({ type: "UPDATE_DASHBOARD_WIDGETS", payload: widgets })
      await updateDashboardWidgets(widgets)
    }
    setResizingWidget(null)
    setResizeStart(null)
    setResizeType(null)
  }

  // Ajouter les event listeners pour le resize
  useEffect(() => {
    if (resizingWidget) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [resizingWidget])

  const changeWidgetType = async (widgetId: string, newType: WidgetType) => {
    const updatedWidgets = widgets.map((w) =>
      w.id === widgetId ? { ...w, type: newType } : w
    )
    setWidgets(updatedWidgets)
    dispatch({ type: "UPDATE_DASHBOARD_WIDGETS", payload: updatedWidgets })
    await updateDashboardWidgets(updatedWidgets)
    setEditingWidget(null)
    setEditWidgetType(null)
  }

  const deleteWidget = async (widgetId: string) => {
    const updatedWidgets = widgets.filter((w) => w.id !== widgetId)
    setWidgets(updatedWidgets)
    dispatch({ type: "UPDATE_DASHBOARD_WIDGETS", payload: updatedWidgets })
    await updateDashboardWidgets(updatedWidgets)
  }

  const resetToDefault = async () => {
    const defaultWidgets: DashboardWidget[] = [
      { id: "1", type: "routine-progress", enabled: true, order: 0, width: 1, height: 1 },
      { id: "2", type: "missions-stats", enabled: true, order: 1, width: 1, height: 1 },
      { id: "3", type: "tasks-stats", enabled: true, order: 2, width: 1, height: 1 },
      { id: "4", type: "projects-stats", enabled: true, order: 3, width: 1, height: 1 },
      { id: "5", type: "routine-list", enabled: true, order: 4, width: 2, height: 1 },
      { id: "6", type: "today-missions", enabled: true, order: 5, width: 2, height: 1 },
      { id: "7", type: "week-missions", enabled: true, order: 6, width: 2, height: 1 },
      { id: "8", type: "active-projects", enabled: true, order: 7, width: 2, height: 1 },
    ]
    setWidgets(defaultWidgets)
    dispatch({ type: "UPDATE_DASHBOARD_WIDGETS", payload: defaultWidgets })
    await updateDashboardWidgets(defaultWidgets)
    setShowResetConfirm(false)
  }

  const renderWidget = (widget: DashboardWidget) => {
    const widgetConfig = WIDGET_LABELS[widget.type]

    switch (widget.type) {
      case "routine-progress":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Routine du jour</p>
                  <p className="text-2xl font-bold">{routineProgress}%</p>
                </div>
                <div className="rounded-full bg-success/10 p-2">
                  <CheckCircle2 className="size-5 text-success" />
                </div>
              </div>
              <Progress value={routineProgress} className="mt-2 h-1" />
            </CardContent>
          </Card>
        )

      case "missions-stats":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Missions</p>
                  <p className="text-2xl font-bold">
                    {stats.missionsCompleted}/{stats.missionsTotal}
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 p-2">
                  <Target className="size-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "tasks-stats":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tâches</p>
                  <p className="text-2xl font-bold">
                    {stats.tasksCompleted}/{stats.tasksTotal}
                  </p>
                </div>
                <div className="rounded-full bg-accent/10 p-2">
                  <CheckCircle2 className="size-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "projects-stats":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Projets actifs</p>
                  <p className="text-2xl font-bold">{stats.projectsActive}</p>
                </div>
                <div className="rounded-full bg-warning/10 p-2">
                  <TrendingUp className="size-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "sleep-summary":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sommeil moyen</p>
                  <p className="text-2xl font-bold">{stats.avgSleepHours}h</p>
                  <p className="text-xs text-muted-foreground">7 derniers jours</p>
                </div>
                <div className="rounded-full bg-blue-500/10 p-2">
                  <Bed className="size-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "night-routine-progress":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Routine du soir</p>
                  <p className="text-2xl font-bold">{nightRoutineProgress}%</p>
                </div>
                <div className="rounded-full bg-purple-500/10 p-2">
                  <Moon className="size-5 text-purple-600" />
                </div>
              </div>
              <Progress value={nightRoutineProgress} className="mt-2 h-1" />
            </CardContent>
          </Card>
        )

      case "workout-summary":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Entraînements</p>
                  <p className="text-2xl font-bold">{stats.weekWorkouts}</p>
                  <p className="text-xs text-muted-foreground">Cette semaine</p>
                </div>
                <div className="rounded-full bg-orange-500/10 p-2">
                  <Dumbbell className="size-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "routine-list":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Routine matinale</CardTitle>
                <CardDescription>
                  {todayLogs.filter((l) => l.completed).length}/{state.routineActions.length} complétées
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("routine")}>
                Voir tout
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 flex-1 overflow-auto">
              {state.routineActions.slice(0, 5).map((action) => {
                const log = todayLogs.find((l) => l.actionId === action.id)
                const isCompleted = log?.completed || false
                const streak = calculateStreak(state.routineLogs, action.id)

                return (
                  <div
                    key={action.id}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isCompleted}
                        onCheckedChange={() => toggleRoutine(action.id)}
                      />
                      <div>
                        <p className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                          {action.name}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{action.category}</p>
                      </div>
                    </div>
                    {streak.current > 0 && (
                      <div className="flex items-center gap-1 text-orange-500">
                        <Flame className="size-4" />
                        <span className="text-xs font-medium">{streak.current}j</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )

      case "today-missions":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Missions du jour</CardTitle>
                <CardDescription>{todayMissions.length} missions en attente</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("missions")}>
                Voir tout
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 flex-1 overflow-auto">
              {todayMissions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucune mission pour aujourd&apos;hui
                </p>
              ) : (
                todayMissions.map((mission) => (
                  <div
                    key={mission.id}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {mission.status === "done" ? (
                        <CheckCircle2 className="size-5 text-success" />
                      ) : mission.status === "in-progress" ? (
                        <Clock className="size-5 text-primary" />
                      ) : (
                        <Circle className="size-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{mission.title}</p>
                        {mission.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{mission.description}</p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={
                        mission.priority === "high"
                          ? "destructive"
                          : mission.priority === "medium"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {mission.priority === "high" ? "Haute" : mission.priority === "medium" ? "Moyenne" : "Basse"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )

      case "week-missions":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Missions de la semaine</CardTitle>
                <CardDescription>{weekMissions.length} missions cette semaine</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("missions")}>
                Voir tout
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 flex-1 overflow-auto">
              {weekMissions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucune mission pour cette semaine
                </p>
              ) : (
                weekMissions.map((mission) => (
                  <div
                    key={mission.id}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {mission.status === "done" ? (
                        <CheckCircle2 className="size-5 text-success" />
                      ) : mission.status === "in-progress" ? (
                        <Clock className="size-5 text-primary" />
                      ) : (
                        <Circle className="size-5 text-muted-foreground" />
                      )}
                      <p className="text-sm font-medium">{mission.title}</p>
                    </div>
                    <Badge variant="outline">{mission.tasks.length} tâches</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )

      case "active-projects":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Projets en cours</CardTitle>
                <CardDescription>{activeProjects.length} projets actifs</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("projects")}>
                Voir tout
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 overflow-auto">
              {activeProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucun projet en cours
                </p>
              ) : (
                activeProjects.map((project) => {
                  const progress = getProjectProgress(project.id)
                  return (
                    <div key={project.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{project.title}</p>
                        <span className="text-xs text-muted-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                      {project.deadline && (
                        <p className="text-xs text-muted-foreground">
                          Échéance : {formatDateFr(project.deadline, "short")}
                        </p>
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        )

      // Nouveaux widgets granulaires
      case "sleep-bedtime-cycles":
        const now = new Date()
        const cycleLength = 90 // minutes
        const cycles = 6
        const sleepTime = cycles * cycleLength + 15 // 15min pour s'endormir
        const wakeTime = new Date(now.getTime() + sleepTime * 60000)
        const bedTime = new Date(now.getTime() + 15 * 60000) // Dans 15 min
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Coucher maintenant</p>
                  <p className="text-2xl font-bold">
                    {bedTime.getHours().toString().padStart(2, '0')}:{bedTime.getMinutes().toString().padStart(2, '0')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Réveil à {wakeTime.getHours().toString().padStart(2, '0')}:{wakeTime.getMinutes().toString().padStart(2, '0')} (6 cycles)
                  </p>
                </div>
                <div className="rounded-full bg-blue-500/10 p-2">
                  <Bed className="size-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "sleep-quality-avg":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Qualité moyenne</p>
                  <p className="text-2xl font-bold">
                    {stats.avgSleepQuality ? `${stats.avgSleepQuality}%` : "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">7 derniers jours</p>
                </div>
                <div className="rounded-full bg-blue-500/10 p-2">
                  <Bed className="size-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "sleep-duration-avg":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Durée moyenne</p>
                  <p className="text-2xl font-bold">{stats.avgSleepHours}h</p>
                  <p className="text-xs text-muted-foreground">Par nuit</p>
                </div>
                <div className="rounded-full bg-blue-500/10 p-2">
                  <Bed className="size-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "workout-week-count":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Séances semaine</p>
                  <p className="text-2xl font-bold">{stats.weekWorkouts}</p>
                  <p className="text-xs text-muted-foreground">Cette semaine</p>
                </div>
                <div className="rounded-full bg-orange-500/10 p-2">
                  <Dumbbell className="size-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "routine-streak":
        const longestStreak = Math.max(
          ...state.routineActions.map(action => calculateStreak(state.routineLogs, action.id).longest),
          0
        )
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Meilleure série</p>
                  <p className="text-2xl font-bold">{longestStreak}</p>
                  <p className="text-xs text-muted-foreground">Jours consécutifs</p>
                </div>
                <div className="rounded-full bg-orange-500/10 p-2">
                  <Flame className="size-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <p className="text-sm text-muted-foreground text-center">Widget en développement</p>
            </CardContent>
          </Card>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bonjour !</h1>
          <p className="text-muted-foreground">
            {formatDateFr(new Date(), "full")} - Prêt pour une journée productive ?
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefault}>
            <RotateCcw className="mr-2 size-4" />
            Dashbord par défaut
          </Button>
          <Button variant="outline" onClick={() => setShowWidgetConfig(true)}>
            <Settings className="mr-2 size-4" />
            Personnaliser
          </Button>
        </div>
      </div>

      {/* Daily Insight */}
      {state.settings.showDailyInsight && visibleInsight && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-4 p-4">
            <div className="rounded-full bg-primary/10 p-2">
              <Lightbulb className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{visibleInsight.content}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {visibleInsight.category === "productivity"
                    ? "Productivité"
                    : visibleInsight.category === "health"
                      ? "Santé"
                      : visibleInsight.category === "motivation"
                        ? "Motivation"
                        : "Fun fact"}
                </Badge>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => dispatch({ type: "LIKE_INSIGHT", payload: visibleInsight.id })}
              >
                <Heart className={`size-4 ${visibleInsight.liked ? "fill-red-500 text-red-500" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => dispatch({ type: "HIDE_INSIGHT", payload: visibleInsight.id })}
              >
                <X className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Widgets Grid */}
      {enabledWidgets.length === 0 ? (
        <div className="grid gap-4 grid-cols-4 auto-rows-[200px]">
          {/* Aperçu des widgets par défaut en pointillés */}
          <Card className="col-span-2 row-span-1 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => addWidget("today-missions")}>
            <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center relative">
              <Target className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Missions du jour</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Vos tâches importantes</p>
              <Button 
                size="icon" 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  addWidget("today-missions")
                }}
              >
                <Plus className="size-5" />
              </Button>
            </CardContent>
          </Card>
          
          <Card className="col-span-2 row-span-1 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => addWidget("tasks-stats")}>
            <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center relative">
              <CheckCircle2 className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Tâches rapides</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Actions à compléter</p>
              <Button 
                size="icon" 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  addWidget("tasks-stats")
                }}
              >
                <Plus className="size-5" />
              </Button>
            </CardContent>
          </Card>

          <Card className="col-span-1 row-span-1 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => addWidget("routine-progress")}>
            <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center relative">
              <TrendingUp className="size-8 text-muted-foreground mb-2" />
              <p className="text-xs font-medium text-muted-foreground">Progression</p>
              <Button 
                size="icon" 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  addWidget("routine-progress")
                }}
              >
                <Plus className="size-5" />
              </Button>
            </CardContent>
          </Card>

          <Card className="col-span-1 row-span-1 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => addWidget("routine-streak")}>
            <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center relative">
              <Flame className="size-8 text-muted-foreground mb-2" />
              <p className="text-xs font-medium text-muted-foreground">Série</p>
              <Button 
                size="icon" 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  addWidget("routine-streak")
                }}
              >
                <Plus className="size-5" />
              </Button>
            </CardContent>
          </Card>

          <Card className="col-span-2 row-span-1 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => addWidget("routine-list")}>
            <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center relative">
              <Clock className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Routines</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Vos habitudes quotidiennes</p>
              <Button 
                size="icon" 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  addWidget("routine-list")
                }}
              >
                <Plus className="size-5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-4 auto-rows-[200px]" style={{ gridAutoFlow: 'dense' }}>
          {enabledWidgets.map((widget) => (
          <div
            key={widget.id}
            onDragOver={(e) => handleDragOver(e, widget.id)}
            onDrop={(e) => handleDrop(e, widget.id)}
            className={cn(
              "relative transition-all group",
              widget.width === 1 && "col-span-1",
              widget.width === 2 && "col-span-2",
              widget.width === 3 && "col-span-3",
              widget.width === 4 && "col-span-4",
              widget.height === 1 && "row-span-1",
              widget.height === 2 && "row-span-2",
              draggedWidget === widget.id && "opacity-50",
              dragOverWidget === widget.id && "ring-2 ring-primary"
            )}
          >
            {/* Widget Controls */}
            <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Drag Handle */}
              <div
                draggable={!resizingWidget}
                onDragStart={(e) => handleDragStart(e, widget.id)}
                onDragEnd={handleDragEnd}
                className="rounded-lg bg-background/95 shadow-lg border p-1 cursor-move hover:bg-accent"
                title="Déplacer"
              >
                <GripVertical className="size-4" />
              </div>
              <div className="rounded-lg bg-background/95 shadow-lg border p-1 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingWidget(widget.id)
                    setEditWidgetType(widget.type)
                  }}
                  title="Changer le contenu"
                >
                  <Edit3 className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteWidget(widget.id)
                  }}
                  title="Supprimer"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>

            {/* Drag Handle */}
            <div className="absolute top-2 left-2 z-10 rounded-full bg-background/80 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="size-4 text-muted-foreground" />
            </div>

            {/* Container avec h-full et w-full pour que la Card prenne tout l'espace */}
            <div className="h-full w-full relative">
              {renderWidget(widget)}
              
              {/* Resize Handle - Largeur (bord droit) */}
              <div
                className="absolute top-0 right-0 z-30 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20"
                onMouseDown={(e) => handleResizeStart(e, widget.id, 'width')}
                title="Glisser pour ajuster la largeur"
              />
              
              {/* Resize Handle - Hauteur (bord bas) */}
              <div
                className="absolute bottom-0 left-0 z-30 w-full h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20"
                onMouseDown={(e) => handleResizeStart(e, widget.id, 'height')}
                title="Glisser pour ajuster la hauteur"
              />
              
              {/* Resize Handle - Les deux (coin bas-droit) */}
              <div
                className="absolute bottom-0 right-0 z-40 w-6 h-6 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end"
                onMouseDown={(e) => handleResizeStart(e, widget.id, 'both')}
                title="Glisser pour ajuster largeur et hauteur"
              >
                <div className="w-3 h-3 border-r-3 border-b-3 border-primary/80 rounded-br-sm" style={{ borderWidth: '3px' }} />
              </div>
              
              {/* Indicateur de taille pendant le resize */}
              {resizingWidget === widget.id && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg font-bold text-sm pointer-events-none">
                  {widget.width} × {widget.height}
                </div>
              )}
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Edit Widget Type Dialog */}
      <Dialog open={editingWidget !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingWidget(null)
          setEditWidgetType(null)
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Changer le contenu du widget</DialogTitle>
            <DialogDescription>
              Sélectionnez le nouveau type de contenu à afficher
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            {Object.entries(WIDGET_LABELS).map(([type, config]) => {
              const Icon = config.icon
              const isSelected = editWidgetType === type
              return (
                <button
                  key={type}
                  onClick={() => setEditWidgetType(type as WidgetType)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:border-primary/50",
                    isSelected && "border-primary bg-primary/5"
                  )}
                >
                  <Icon className={cn("size-6", isSelected && "text-primary")} />
                  <div className="text-center">
                    <p className="text-sm font-medium">{config.label}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{config.description}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingWidget(null)
                setEditWidgetType(null)
              }}
              className="flex-1 sm:flex-initial"
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (editingWidget && editWidgetType) {
                  changeWidgetType(editingWidget, editWidgetType)
                }
              }}
              disabled={!editWidgetType}
              className="flex-1 sm:flex-initial"
            >
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Widget Configuration Dialog */}
      <Dialog open={showWidgetConfig} onOpenChange={setShowWidgetConfig}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Personnaliser le tableau de bord</DialogTitle>
            <DialogDescription>
              Activez ou désactivez les widgets à afficher.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Widgets actifs</h3>
              {widgets.filter((w) => w.enabled).map((widget) => {
                const config = WIDGET_LABELS[widget.type]
                const Icon = config.icon
                return (
                  <div
                    key={widget.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Icon className="size-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{config.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{config.description}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleWidget(widget.id)}
                      className="shrink-0 self-end sm:self-auto"
                    >
                      Masquer
                    </Button>
                  </div>
                )
              })}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Widgets disponibles</h3>
              
              {Object.entries(
                Object.entries(WIDGET_LABELS).reduce((acc, [type, config]) => {
                  const category = config.category || "Autre"
                  if (!acc[category]) acc[category] = []
                  acc[category].push([type, config])
                  return acc
                }, {} as Record<string, [string, typeof WIDGET_LABELS[WidgetType]][]>)
              ).map(([category, categoryWidgets]) => (
                <div key={category} className="space-y-2 mb-4">
                  <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mt-3">
                    {category}
                  </h4>
                  {categoryWidgets.map(([type, config]) => {
                    const isEnabled = widgets.some((w) => w.type === type && w.enabled)
                    if (isEnabled) return null
                    
                    const Icon = config.icon
                    return (
                      <div
                        key={type}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between rounded-lg border p-3 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Icon className="size-5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{config.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{config.description}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const existingWidget = widgets.find((w) => w.type === type)
                            if (existingWidget) {
                              toggleWidget(existingWidget.id)
                            } else {
                              addWidget(type as WidgetType)
                            }
                          }}
                          className="shrink-0 self-end sm:self-auto"
                        >
                          <Plus className="size-4 mr-1" />
                          Ajouter
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button onClick={() => setShowWidgetConfig(false)} className="w-full sm:w-auto">Terminé</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser le tableau de bord ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va supprimer tous vos widgets personnalisés et restaurer la configuration par défaut. 
              Cette opération ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={resetToDefault}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
