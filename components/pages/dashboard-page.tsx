"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  Plus,
  Settings,
  RotateCcw,
  Moon,
  Sun,
  Bed,
  Dumbbell,
  FolderOpen,
  Trash2,
  Edit3,
  Apple,
  Monitor,
  Smartphone,
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
  "routine-progress": { label: "Routine matinale", description: "Progression de la routine matinale", icon: Sun, category: "Routine" },
  "routine-streak": { label: "Série routine", description: "Nombre de jours consécutifs", icon: Flame, category: "Routine" },
  "routine-list": { label: "Liste routine matinale", description: "Actions de la routine matinale", icon: Sun, category: "Routine" },
  
  "night-routine-progress": { label: "Routine du soir", description: "Progression routine du soir", icon: Moon, category: "Routine" },
  "night-routine-list": { label: "Liste routine soir", description: "Actions de la routine du soir", icon: Moon, category: "Routine" },
  
  "missions-stats": { label: "Missions", description: "Statistiques des missions", icon: Target, category: "Missions" },
  "today-missions": { label: "Missions du jour", description: "Missions à faire aujourd'hui", icon: Target, category: "Missions" },
  "week-missions": { label: "Missions semaine", description: "Missions de la semaine", icon: Target, category: "Missions" },
  "mission-priority-high": { label: "Missions urgentes", description: "Missions haute priorité", icon: Target, category: "Missions" },
  
  "tasks-stats": { label: "Tâches", description: "Statistiques des tâches", icon: CheckCircle2, category: "Tâches" },
  "tasks-today": { label: "Tâches du jour", description: "Tâches à faire aujourd'hui", icon: CheckCircle2, category: "Tâches" },
  "tasks-urgent": { label: "Tâches urgentes", description: "Tâches avec deadline proche", icon: Clock, category: "Tâches" },
  
  "projects-stats": { label: "Projets actifs", description: "Nombre de projets en cours", icon: FolderOpen, category: "Projets" },
  "active-projects": { label: "Projets en cours", description: "Liste des projets actifs", icon: FolderOpen, category: "Projets" },
  "project-progress": { label: "Progression projet", description: "Progression détaillée des projets", icon: FolderOpen, category: "Projets" },
  
  "sleep-summary": { label: "Sommeil", description: "Résumé du sommeil", icon: Bed, category: "Sommeil" },
  "sleep-bedtime-cycles": { label: "Heure de coucher", description: "Heure pour 6 cycles de sommeil", icon: Bed, category: "Sommeil" },
  "sleep-quality-avg": { label: "Qualité sommeil", description: "Qualité moyenne du sommeil", icon: Bed, category: "Sommeil" },
  "sleep-duration-avg": { label: "Durée sommeil", description: "Durée moyenne par nuit", icon: Bed, category: "Sommeil" },
  "sleep-last-night": { label: "Nuit dernière", description: "Détails de la dernière nuit", icon: Bed, category: "Sommeil" },
  
  "workout-summary": { label: "Sport", description: "Résumé des entraînements", icon: Dumbbell, category: "Sport" },
  "workout-week-count": { label: "Séances semaine", description: "Nombre d'entraînements cette semaine", icon: Dumbbell, category: "Sport" },
  "workout-last-session": { label: "Dernier entraînement", description: "Détails de la dernière séance", icon: Dumbbell, category: "Sport" },
  "workout-calories": { label: "Calories brûlées", description: "Calories de la semaine", icon: Dumbbell, category: "Sport" },
  
  "nutrition-daily": { label: "Nutrition du jour", description: "Apports nutritionnels aujourd'hui", icon: Apple, category: "Nutrition" },
  "nutrition-macros": { label: "Macros", description: "Répartition protéines/glucides/lipides", icon: Apple, category: "Nutrition" },
}

const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: "1", type: "routine-progress", enabled: true, order: 0, width: 1, height: 1, row: 0, col: 0 },
  { id: "2", type: "missions-stats", enabled: true, order: 1, width: 1, height: 1, row: 0, col: 1 },
  { id: "3", type: "tasks-stats", enabled: true, order: 2, width: 1, height: 1, row: 0, col: 2 },
  { id: "4", type: "projects-stats", enabled: true, order: 3, width: 1, height: 1, row: 0, col: 3 },
  { id: "5", type: "routine-list", enabled: true, order: 4, width: 2, height: 1, row: 1, col: 0 },
  { id: "6", type: "today-missions", enabled: true, order: 5, width: 2, height: 1, row: 1, col: 2 },
  { id: "7", type: "week-missions", enabled: true, order: 6, width: 2, height: 1, row: 2, col: 0 },
  { id: "8", type: "active-projects", enabled: true, order: 7, width: 2, height: 1, row: 2, col: 2 },
]

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { state, dispatch, isLoading, updateDashboardWidgets, updateMission, logRoutine } = useApp()
  const today = getToday()
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [editingWidget, setEditingWidget] = useState<string | null>(null)
  const [editWidgetType, setEditWidgetType] = useState<WidgetType | null>(null)
  
  // États pour l'éditeur de grille avancé
  const [gridEditorOpen, setGridEditorOpen] = useState(false)
  const [gridSelectionStart, setGridSelectionStart] = useState<{ row: number; col: number } | null>(null)
  const [gridSelectionEnd, setGridSelectionEnd] = useState<{ row: number; col: number } | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedWidgetType, setSelectedWidgetType] = useState<WidgetType | null>(null)
  const [editorWidgets, setEditorWidgets] = useState<DashboardWidget[]>([])
  const [editorMobileWidgets, setEditorMobileWidgets] = useState<DashboardWidget[]>([])
  const [draggedAvailableWidget, setDraggedAvailableWidget] = useState<WidgetType | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const [draggingEditorWidget, setDraggingEditorWidget] = useState<string | null>(null)
  const [showMobileWidgetPanel, setShowMobileWidgetPanel] = useState(false)
  const [separateMobileLayout, setSeparateMobileLayout] = useState(false)
  const [editingMobileLayout, setEditingMobileLayout] = useState(false)
  const [resizingWidget, setResizingWidget] = useState<{ id: string; edge: "right" | "bottom" | "corner" | "left" | "top" } | null>(null)
  const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number } | null>(null)

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

  const toggleRoutine = async (actionId: string) => {
    const existingLog = todayLogs.find((l) => l.actionId === actionId)
    await logRoutine(actionId, today, !existingLog?.completed)
  }

  const toggleMission = async (mission: any) => {
    const newStatus = mission.status === "done" ? "todo" : "done"
    await updateMission({
      ...mission,
      status: newStatus,
      completedAt: newStatus === "done" ? new Date().toISOString() : undefined,
    })
  }

  const getProjectProgress = (projectId: string) => {
    const projectTasks = state.tasks.filter((t) => t.projectId === projectId)
    if (projectTasks.length === 0) return 0
    const completed = projectTasks.filter((t) => t.status === "done").length
    return Math.round((completed / projectTasks.length) * 100)
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

  const resetToDefault = async () => {
    const defaultWidgets: DashboardWidget[] = [
      { id: "1", type: "routine-progress", enabled: true, order: 0, width: 1, height: 1, row: 0, col: 0 },
      { id: "2", type: "missions-stats", enabled: true, order: 1, width: 1, height: 1, row: 0, col: 1 },
      { id: "3", type: "tasks-stats", enabled: true, order: 2, width: 1, height: 1, row: 0, col: 2 },
      { id: "4", type: "projects-stats", enabled: true, order: 3, width: 1, height: 1, row: 0, col: 3 },
      { id: "5", type: "routine-list", enabled: true, order: 4, width: 2, height: 1, row: 1, col: 0 },
      { id: "6", type: "today-missions", enabled: true, order: 5, width: 2, height: 1, row: 1, col: 2 },
      { id: "7", type: "week-missions", enabled: true, order: 6, width: 2, height: 1, row: 2, col: 0 },
      { id: "8", type: "active-projects", enabled: true, order: 7, width: 2, height: 1, row: 2, col: 2 },
    ]
    setWidgets(defaultWidgets)
    dispatch({ type: "UPDATE_DASHBOARD_WIDGETS", payload: defaultWidgets })
    await updateDashboardWidgets(defaultWidgets)
    setShowResetConfirm(false)
  }

  // Fonctions pour l'éditeur de grille avancé
  const openGridEditor = () => {
    setEditorWidgets([...widgets])
    setEditorMobileWidgets([...widgets]) // Clone pour mobile
    setSeparateMobileLayout(false)
    setEditingMobileLayout(false)
    setGridEditorOpen(true)
  }

  const closeGridEditor = () => {
    setGridEditorOpen(false)
    setGridSelectionStart(null)
    setGridSelectionEnd(null)
    setIsSelecting(false)
    setSelectedWidgetType(null)
    setDraggedAvailableWidget(null)
    setDraggingEditorWidget(null)
    setEditingWidget(null)
    setEditWidgetType(null)
    setShowMobileWidgetPanel(false)
    setResizingWidget(null)
    setResizeStartPos(null)
    setEditingMobileLayout(false)
  }

  const applyGridChanges = async () => {
    // Pour l'instant on utilise juste les widgets desktop
    // TODO: Si separateMobileLayout, sauvegarder aussi les widgets mobile
    setWidgets(editorWidgets)
    dispatch({ type: "UPDATE_DASHBOARD_WIDGETS", payload: editorWidgets })
    await updateDashboardWidgets(editorWidgets)
    closeGridEditor()
  }

  // Fonction pour gérer le début du redimensionnement dynamique
  const handleResizeStart = (e: React.MouseEvent, widgetId: string, edge: "right" | "bottom" | "corner" | "left" | "top") => {
    e.preventDefault()
    e.stopPropagation()
    setResizingWidget({ id: widgetId, edge })
    setResizeStartPos({ x: e.clientX, y: e.clientY })
  }

  // Fonction pour gérer le redimensionnement dynamique
  const handleResizeMove = (e: React.MouseEvent) => {
    if (!resizingWidget || !resizeStartPos) return
    
    const widget = (editingMobileLayout ? editorMobileWidgets : editorWidgets).find(w => w.id === resizingWidget.id)
    if (!widget || widget.row === undefined || widget.col === undefined) return

    const cellSize = 80 // Taille approximative d'une cellule
    const deltaX = e.clientX - resizeStartPos.x
    const deltaY = e.clientY - resizeStartPos.y
    
    let newWidth: 1 | 2 | 3 | 4 = widget.width
    let newHeight: 1 | 2 | 3 | 4 | 5 | 6 = widget.height
    let newRow = widget.row
    let newCol = widget.col

    // Redimensionnement horizontal (droite/gauche)
    if (resizingWidget.edge === "right" || resizingWidget.edge === "corner") {
      if (deltaX > cellSize / 2 && widget.width < gridCols && widget.col + widget.width < gridCols) {
        newWidth = Math.min(widget.width + 1, gridCols) as 1 | 2 | 3 | 4
        setResizeStartPos({ x: e.clientX, y: resizeStartPos.y })
      } else if (deltaX < -cellSize / 2 && widget.width > 1) {
        newWidth = Math.max(widget.width - 1, 1) as 1 | 2 | 3 | 4
        setResizeStartPos({ x: e.clientX, y: resizeStartPos.y })
      }
    } else if (resizingWidget.edge === "left") {
      if (deltaX < -cellSize / 2 && widget.width < gridCols && widget.col > 0) {
        newWidth = Math.min(widget.width + 1, gridCols) as 1 | 2 | 3 | 4
        newCol = Math.max(widget.col - 1, 0)
        setResizeStartPos({ x: e.clientX, y: resizeStartPos.y })
      } else if (deltaX > cellSize / 2 && widget.width > 1) {
        newWidth = Math.max(widget.width - 1, 1) as 1 | 2 | 3 | 4
        newCol = widget.col + 1
        setResizeStartPos({ x: e.clientX, y: resizeStartPos.y })
      }
    }

    // Redimensionnement vertical (bas/haut)
    if (resizingWidget.edge === "bottom" || resizingWidget.edge === "corner") {
      const maxHeight = editingMobileLayout ? 6 : 2
      if (deltaY > cellSize / 2 && widget.height < maxHeight && widget.row + widget.height < gridRows) {
        newHeight = Math.min(widget.height + 1, maxHeight) as 1 | 2 | 3 | 4 | 5 | 6
        setResizeStartPos({ x: resizeStartPos.x, y: e.clientY })
      } else if (deltaY < -cellSize / 2 && widget.height > 1) {
        newHeight = Math.max(widget.height - 1, 1) as 1 | 2 | 3 | 4 | 5 | 6
        setResizeStartPos({ x: resizeStartPos.x, y: e.clientY })
      }
    } else if (resizingWidget.edge === "top") {
      const maxHeight = editingMobileLayout ? 6 : 2
      if (deltaY < -cellSize / 2 && widget.height < maxHeight && widget.row > 0) {
        newHeight = Math.min(widget.height + 1, maxHeight) as 1 | 2 | 3 | 4 | 5 | 6
        newRow = Math.max(widget.row - 1, 0)
        setResizeStartPos({ x: resizeStartPos.x, y: e.clientY })
      } else if (deltaY > cellSize / 2 && widget.height > 1) {
        newHeight = Math.max(widget.height - 1, 1) as 1 | 2 | 3 | 4 | 5 | 6
        newRow = widget.row + 1
        setResizeStartPos({ x: resizeStartPos.x, y: e.clientY })
      }
    }

    if (newWidth !== widget.width || newHeight !== widget.height || newRow !== widget.row || newCol !== widget.col) {
      if (canPlaceWidget(newRow, newCol, newWidth, newHeight, widget.id)) {
        const updateFn = editingMobileLayout ? setEditorMobileWidgets : setEditorWidgets
        const currentWidgets = editingMobileLayout ? editorMobileWidgets : editorWidgets
        updateFn(currentWidgets.map(w =>
          w.id === widget.id ? { ...w, width: newWidth, height: newHeight, row: newRow, col: newCol } : w
        ))
      }
    }
  }

  const handleResizeEnd = () => {
    setResizingWidget(null)
    setResizeStartPos(null)
  }

  // Widgets à afficher dans l'éditeur selon le mode
  const currentEditorWidgets = editingMobileLayout ? editorMobileWidgets : editorWidgets
  const setCurrentEditorWidgets = editingMobileLayout ? setEditorMobileWidgets : setEditorWidgets
  
  // Dimensions de grille selon le mode
  const gridCols = editingMobileLayout ? 2 : 4
  const gridRows = editingMobileLayout ? 6 : 4

  const getGridOccupancy = (widgetList: DashboardWidget[] = currentEditorWidgets) => {
    const grid: (string | null)[][] = Array(gridRows).fill(null).map(() => Array(gridCols).fill(null))
    widgetList.filter(w => w.enabled && w.row !== undefined && w.col !== undefined).forEach(widget => {
      for (let r = widget.row!; r < Math.min(widget.row! + widget.height, gridRows); r++) {
        for (let c = widget.col!; c < Math.min(widget.col! + widget.width, gridCols); c++) {
          grid[r][c] = widget.id
        }
      }
    })
    return grid
  }

  const canPlaceWidget = (row: number, col: number, width: number, height: number, excludeId?: string) => {
    if (row + height > gridRows || col + width > gridCols) return false
    const grid = getGridOccupancy(currentEditorWidgets)
    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        if (grid[r][c] !== null && grid[r][c] !== excludeId) return false
      }
    }
    return true
  }

  const handleGridCellMouseDown = (row: number, col: number) => {
    const grid = getGridOccupancy()
    const widgetId = grid[row][col]
    
    if (widgetId) {
      // Sélection d'un widget existant pour modification
      const widget = editorWidgets.find(w => w.id === widgetId)
      if (widget) {
        setEditingWidget(widgetId)
        setEditWidgetType(widget.type)
      }
      return
    }
    
    // Commencer une nouvelle sélection
    setGridSelectionStart({ row, col })
    setGridSelectionEnd({ row, col })
    setIsSelecting(true)
  }

  const handleGridCellMouseEnter = (row: number, col: number) => {
    setHoveredCell({ row, col })
    if (isSelecting && gridSelectionStart) {
      setGridSelectionEnd({ row, col })
    }
  }

  const handleGridCellMouseUp = () => {
    if (isSelecting && gridSelectionStart && gridSelectionEnd) {
      const minRow = Math.min(gridSelectionStart.row, gridSelectionEnd.row)
      const maxRow = Math.max(gridSelectionStart.row, gridSelectionEnd.row)
      const minCol = Math.min(gridSelectionStart.col, gridSelectionEnd.col)
      const maxCol = Math.max(gridSelectionStart.col, gridSelectionEnd.col)
      
      const width = (maxCol - minCol + 1) as 1 | 2 | 3 | 4
      const maxHeight = editingMobileLayout ? 6 : 2
      const height = Math.min(maxRow - minRow + 1, maxHeight) as 1 | 2 | 3 | 4 | 5 | 6
      
      if (canPlaceWidget(minRow, minCol, width, height)) {
        // Ouvrir le sélecteur de widget
        setGridSelectionStart({ row: minRow, col: minCol })
        setGridSelectionEnd({ row: minRow + height - 1, col: minCol + width - 1 })
      } else {
        setGridSelectionStart(null)
        setGridSelectionEnd(null)
      }
    }
    setIsSelecting(false)
  }

  const addWidgetToGrid = (type: WidgetType) => {
    if (!gridSelectionStart || !gridSelectionEnd) return
    
    const minRow = Math.min(gridSelectionStart.row, gridSelectionEnd.row)
    const maxRow = Math.max(gridSelectionStart.row, gridSelectionEnd.row)
    const minCol = Math.min(gridSelectionStart.col, gridSelectionEnd.col)
    const maxCol = Math.max(gridSelectionStart.col, gridSelectionEnd.col)
    
    const width = (maxCol - minCol + 1) as 1 | 2 | 3 | 4
    const maxHeight = editingMobileLayout ? 6 : 2
    const height: 1 | 2 | 3 | 4 | 5 | 6 = Math.min(maxRow - minRow + 1, maxHeight) as 1 | 2 | 3 | 4 | 5 | 6
    
    const newWidget: DashboardWidget = {
      id: generateId(),
      type,
      enabled: true,
      order: currentEditorWidgets.length,
      width,
      height,
      row: minRow,
      col: minCol,
    }
    
    setCurrentEditorWidgets([...currentEditorWidgets, newWidget])
    setGridSelectionStart(null)
    setGridSelectionEnd(null)
    setSelectedWidgetType(null)
  }

  const removeWidgetFromGrid = (widgetId: string) => {
    setCurrentEditorWidgets(currentEditorWidgets.filter(w => w.id !== widgetId))
    setEditingWidget(null)
    setEditWidgetType(null)
  }

  const updateWidgetInGrid = (widgetId: string, newType: WidgetType) => {
    setCurrentEditorWidgets(currentEditorWidgets.map(w =>
      w.id === widgetId ? { ...w, type: newType } : w
    ))
    setEditingWidget(null)
    setEditWidgetType(null)
  }

  const handleDropOnGrid = (row: number, col: number) => {
    // Déplacement d'un widget existant
    if (draggingEditorWidget) {
      const widget = currentEditorWidgets.find(w => w.id === draggingEditorWidget)
      if (widget && canPlaceWidget(row, col, widget.width, widget.height, draggingEditorWidget)) {
        setCurrentEditorWidgets(currentEditorWidgets.map(w =>
          w.id === draggingEditorWidget ? { ...w, row, col } : w
        ))
      }
      setDraggingEditorWidget(null)
      return
    }
    
    // Ajout d'un nouveau widget depuis le panneau
    if (draggedAvailableWidget) {
      if (canPlaceWidget(row, col, 1, 1)) {
        const newWidget: DashboardWidget = {
          id: generateId(),
          type: draggedAvailableWidget,
          enabled: true,
          order: currentEditorWidgets.length,
          width: 1,
          height: 1,
          row,
          col,
        }
        setCurrentEditorWidgets([...currentEditorWidgets, newWidget])
      }
      setDraggedAvailableWidget(null)
    }
  }

  const moveWidgetToCell = (widgetId: string, row: number, col: number) => {
    const widget = currentEditorWidgets.find(w => w.id === widgetId)
    if (!widget) return
    
    if (canPlaceWidget(row, col, widget.width, widget.height, widgetId)) {
      setCurrentEditorWidgets(currentEditorWidgets.map(w =>
        w.id === widgetId ? { ...w, row, col } : w
      ))
    }
  }

  const canDropWidgetAt = (row: number, col: number) => {
    if (draggingEditorWidget) {
      const widget = currentEditorWidgets.find(w => w.id === draggingEditorWidget)
      if (widget) {
        return canPlaceWidget(row, col, widget.width, widget.height, draggingEditorWidget)
      }
    }
    if (draggedAvailableWidget) {
      return canPlaceWidget(row, col, 1, 1)
    }
    return false
  }

  const resizeWidgetInGrid = (widgetId: string, newWidth: 1 | 2 | 3 | 4, newHeight: 1 | 2 | 3 | 4 | 5 | 6) => {
    const widget = currentEditorWidgets.find(w => w.id === widgetId)
    if (!widget || widget.row === undefined || widget.col === undefined) return
    
    if (canPlaceWidget(widget.row, widget.col, newWidth, newHeight, widgetId)) {
      setCurrentEditorWidgets(currentEditorWidgets.map(w =>
        w.id === widgetId ? { ...w, width: newWidth, height: newHeight } : w
      ))
    }
  }

  const isInSelection = (row: number, col: number) => {
    if (!gridSelectionStart || !gridSelectionEnd) return false
    const minRow = Math.min(gridSelectionStart.row, gridSelectionEnd.row)
    const maxRow = Math.max(gridSelectionStart.row, gridSelectionEnd.row)
    const minCol = Math.min(gridSelectionStart.col, gridSelectionEnd.col)
    const maxCol = Math.max(gridSelectionStart.col, gridSelectionEnd.col)
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
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
                      <button
                        onClick={() => toggleMission(mission)}
                        className="shrink-0 focus:outline-none"
                      >
                        {mission.status === "done" ? (
                          <CheckCircle2 className="size-5 text-success" />
                        ) : mission.status === "in-progress" ? (
                          <Clock className="size-5 text-primary" />
                        ) : (
                          <Circle className="size-5 text-muted-foreground hover:text-primary" />
                        )}
                      </button>
                      <div>
                        <p className={`text-sm font-medium ${mission.status === "done" ? "line-through text-muted-foreground" : ""}`}>{mission.title}</p>
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

      case "night-routine-list":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Routine du soir</CardTitle>
                <CardDescription>
                  {todayNightLogs.filter((l) => l.completed).length}/{state.nightRoutineActions.length} complétées
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("routine")}>
                Voir tout
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 flex-1 overflow-auto">
              {state.nightRoutineActions.slice(0, 5).map((action) => {
                const log = todayNightLogs.find((l) => l.actionId === action.id)
                const isCompleted = log?.completed || false

                return (
                  <div
                    key={action.id}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isCompleted}
                        disabled
                      />
                      <div>
                        <p className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                          {action.name}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {action.importance === "high" ? "Important" : action.importance === "medium" ? "Moyen" : "Optionnel"}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )

      case "mission-priority-high":
        const highPriorityMissions = state.missions.filter(
          (m) => m.priority === "high" && m.status !== "done"
        ).slice(0, 4)
        return (
          <Card className="h-full w-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Missions urgentes</CardTitle>
                <CardDescription>{highPriorityMissions.length} en haute priorité</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("missions")}>
                Voir tout
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 flex-1 overflow-auto">
              {highPriorityMissions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucune mission urgente
                </p>
              ) : (
                highPriorityMissions.map((mission) => (
                  <div
                    key={mission.id}
                    className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Target className="size-4 text-destructive" />
                      <p className="text-sm font-medium">{mission.title}</p>
                    </div>
                    <Badge variant="destructive">Haute</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )

      case "tasks-today":
        const todayTasks = state.tasks.filter(
          (t) => t.dueDate === today && t.status !== "done"
        ).slice(0, 5)
        return (
          <Card className="h-full w-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Tâches du jour</CardTitle>
                <CardDescription>{todayTasks.length} à faire</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("projects")}>
                Voir tout
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 flex-1 overflow-auto">
              {todayTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucune tâche pour aujourd&apos;hui
                </p>
              ) : (
                todayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <Circle className="size-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      {task.projectId && (
                        <p className="text-xs text-muted-foreground">
                          {state.projects.find((p) => p.id === task.projectId)?.title || "Projet"}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )

      case "tasks-urgent":
        const urgentTasks = state.tasks.filter((t) => {
          if (t.status === "done" || !t.dueDate) return false
          const dueDate = new Date(t.dueDate)
          const now = new Date()
          const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          return diffDays <= 3 && diffDays >= 0
        }).slice(0, 4)
        return (
          <Card className="h-full w-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Tâches urgentes</CardTitle>
                <CardDescription>Deadline dans 3 jours ou moins</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("projects")}>
                Voir tout
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 flex-1 overflow-auto">
              {urgentTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucune tâche urgente
                </p>
              ) : (
                urgentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3"
                  >
                    <Clock className="size-4 text-orange-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-orange-600">
                        {formatDateFr(task.dueDate!, "short")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )

      case "project-progress":
        return (
          <Card className="h-full w-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Progression des projets</CardTitle>
                <CardDescription>{activeProjects.length} projets en cours</CardDescription>
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
                activeProjects.slice(0, 4).map((project) => {
                  const progress = getProjectProgress(project.id)
                  return (
                    <div key={project.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{project.title}</span>
                        <span className="text-muted-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        )

      case "sleep-last-night":
        const lastSleepLog = state.sleepLogs.length > 0 
          ? state.sleepLogs[state.sleepLogs.length - 1] 
          : null
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              {lastSleepLog ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Dernière nuit</p>
                    <div className="rounded-full bg-blue-500/10 p-2">
                      <Bed className="size-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-lg font-bold">{Math.round(lastSleepLog.duration / 60)}h</p>
                      <p className="text-xs text-muted-foreground">Durée</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-lg font-bold">{lastSleepLog.quality}%</p>
                      <p className="text-xs text-muted-foreground">Qualité</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {formatDateFr(lastSleepLog.date, "short")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Aucune donnée de sommeil
                </p>
              )}
            </CardContent>
          </Card>
        )

      case "workout-last-session":
        const lastWorkout = state.workoutSessions.filter((w) => w.completed)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        const lastWorkoutProgram = lastWorkout?.programId 
          ? state.workoutPrograms.find(p => p.id === lastWorkout.programId) 
          : null
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              {lastWorkout ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Dernier entraînement</p>
                    <div className="rounded-full bg-orange-500/10 p-2">
                      <Dumbbell className="size-5 text-orange-600" />
                    </div>
                  </div>
                  <p className="text-lg font-bold truncate">
                    {lastWorkoutProgram?.name || lastWorkout.customType || lastWorkout.type}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{lastWorkout.duration} min</span>
                    <span className="capitalize">{lastWorkout.intensity}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateFr(lastWorkout.date, "short")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Aucun entraînement récent
                </p>
              )}
            </CardContent>
          </Card>
        )

      case "workout-calories":
        // Estimation des calories basée sur l'intensité et la durée
        const estimateCalories = (duration: number, intensity: string) => {
          const caloriesPerMinute = intensity === "intense" ? 12 : intensity === "moderate" ? 8 : 5
          return duration * caloriesPerMinute
        }
        const weekCalories = state.workoutSessions
          .filter((w) => {
            const weekAgo = new Date()
            weekAgo.setDate(weekAgo.getDate() - 7)
            const workoutDate = new Date(w.date)
            return workoutDate >= weekAgo && w.completed
          })
          .reduce((sum, w) => sum + estimateCalories(w.duration, w.intensity), 0)
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Calories brûlées</p>
                  <p className="text-2xl font-bold">{weekCalories}</p>
                  <p className="text-xs text-muted-foreground">Cette semaine (estimé)</p>
                </div>
                <div className="rounded-full bg-orange-500/10 p-2">
                  <Flame className="size-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "nutrition-daily":
        // Simulé - à connecter aux vraies données
        return (
          <Card className="h-full w-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Nutrition du jour</CardTitle>
                <CardDescription>Vos apports</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("cuisine")}>
                Voir tout
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <p className="text-lg font-bold text-green-600">0</p>
                  <p className="text-[10px] text-muted-foreground">Recettes</p>
                </div>
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <p className="text-lg font-bold text-blue-600">0</p>
                  <p className="text-[10px] text-muted-foreground">kcal</p>
                </div>
                <div className="rounded-lg bg-orange-500/10 p-2">
                  <p className="text-lg font-bold text-orange-600">0g</p>
                  <p className="text-[10px] text-muted-foreground">Protéines</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "nutrition-macros":
        // Simulé - à connecter aux vraies données
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Macronutriments</p>
                <div className="rounded-full bg-green-500/10 p-2">
                  <Apple className="size-4 text-green-600" />
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Protéines</span>
                    <span className="text-muted-foreground">0g / 120g</span>
                  </div>
                  <Progress value={0} className="h-1.5" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Glucides</span>
                    <span className="text-muted-foreground">0g / 250g</span>
                  </div>
                  <Progress value={0} className="h-1.5" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Lipides</span>
                    <span className="text-muted-foreground">0g / 65g</span>
                  </div>
                  <Progress value={0} className="h-1.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      default:
        // Fallback pour les types de widgets non implémentés
        const defaultConfig = WIDGET_LABELS[widget.type as WidgetType]
        const DefaultIcon = defaultConfig?.icon || Target
        return (
          <Card className="h-full w-full flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col items-center justify-center">
              <DefaultIcon className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-center">{defaultConfig?.label || widget.type}</p>
              <p className="text-xs text-muted-foreground text-center mt-1">{defaultConfig?.description || ""}</p>
            </CardContent>
          </Card>
        )
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Bonjour !</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {formatDateFr(new Date(), "full")} - Prêt pour une journée productive ?
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(true)} className="flex-1 sm:flex-none">
            <RotateCcw className="mr-1 sm:mr-2 size-3 sm:size-4" />
            <span className="text-xs sm:text-sm">Par défaut</span>
          </Button>
          <Button variant="outline" size="sm" onClick={openGridEditor} className="flex-1 sm:flex-none">
            <Settings className="mr-1 sm:mr-2 size-3 sm:size-4" />
            <span className="text-xs sm:text-sm">Personnaliser</span>
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
        <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 auto-rows-[120px] sm:auto-rows-[150px]">
          {/* Aperçu des widgets par défaut en pointillés */}
          <Card 
            className="py-0 col-span-2 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
            onClick={openGridEditor}
          >
            <CardContent className="p-3 h-full flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="size-6 text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Routine</p>
            </CardContent>
          </Card>
          
          <Card 
            className="py-0 col-span-2 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
            onClick={openGridEditor}
          >
            <CardContent className="p-3 h-full flex flex-col items-center justify-center text-center">
              <Target className="size-6 text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Missions</p>
            </CardContent>
          </Card>

          <Card 
            className="py-0 col-span-1 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
            onClick={openGridEditor}
          >
            <CardContent className="p-3 h-full flex flex-col items-center justify-center text-center">
              <Clock className="size-6 text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Tâches</p>
            </CardContent>
          </Card>

          <Card 
            className="py-0 col-span-1 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
            onClick={openGridEditor}
          >
            <CardContent className="p-3 h-full flex flex-col items-center justify-center text-center">
              <FolderOpen className="size-6 text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Projets</p>
            </CardContent>
          </Card>

          <Card 
            className="py-0 col-span-2 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
            onClick={openGridEditor}
          >
            <CardContent className="p-3 h-full flex flex-col items-center justify-center text-center">
              <Sun className="size-6 text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Liste routine matinale</p>
              <p className="text-[10px] text-muted-foreground/60">Vos habitudes quotidiennes</p>
            </CardContent>
          </Card>

          <Card 
            className="py-0 col-span-3 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
            onClick={openGridEditor}
          >
            <CardContent className="p-3 h-full flex flex-col items-center justify-center text-center">
              <Target className="size-6 text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Missions du jour</p>
              <p className="text-[10px] text-muted-foreground/60">Vos objectifs importants</p>
            </CardContent>
          </Card>

          <Card 
            className="py-0 col-span-1 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
            onClick={openGridEditor}
          >
            <CardContent className="p-3 h-full flex flex-col items-center justify-center text-center">
              <Dumbbell className="size-6 text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Sport & entraînements</p>
            </CardContent>
          </Card>

          <Card 
            className="py-0 col-span-4 border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
            onClick={openGridEditor}
          >
            <CardContent className="p-3 h-full flex flex-col items-center justify-center text-center">
              <Bed className="size-6 text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-muted-foreground">Sommeil & repos</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 auto-rows-[150px] sm:auto-rows-[200px]" style={{ gridAutoFlow: 'dense' }}>
          {enabledWidgets.map((widget) => (
          <div
            key={widget.id}
            className={cn(
              "relative transition-all",
              widget.height === 1 && "row-span-1",
              widget.height === 2 && "row-span-2",
            )}
            style={{
              gridColumn: widget.col !== undefined 
                ? `${widget.col + 1} / span ${widget.width}` 
                : `span ${Math.min(widget.width, 2)}`,
              gridRow: widget.row !== undefined 
                ? `${widget.row + 1} / span ${widget.height}` 
                : undefined,
            }}
          >
            {/* Container avec h-full et w-full pour que la Card prenne tout l'espace */}
            <div className="h-full w-full">
              {renderWidget(widget)}
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Éditeur de grille avancé - Style CSS Grid Generator */}
      <Dialog open={gridEditorOpen} onOpenChange={(open) => !open && closeGridEditor()}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <div className="flex flex-col h-[85vh] sm:h-[85vh]">
            <DialogHeader className="p-3 sm:p-4 pb-2 border-b shrink-0">
              <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Settings className="size-4 sm:size-5" />
                Personnaliser le tableau de bord
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm hidden sm:block">
                Glissez les widgets sur la grille (4×4 desktop, 2×6 mobile) ou sélectionnez des cellules
              </DialogDescription>
              
              {/* Toggle Desktop/Mobile Layout */}
              <div className="flex items-center gap-4 pt-2 flex-wrap">
                <label className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
                  <Checkbox 
                    checked={separateMobileLayout} 
                    onCheckedChange={(checked) => {
                      setSeparateMobileLayout(checked === true)
                      if (!checked) {
                        setEditingMobileLayout(false)
                      }
                    }}
                  />
                  <span>Séparer la version mobile</span>
                </label>
                
                {separateMobileLayout && (
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    <Button
                      variant={!editingMobileLayout ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => setEditingMobileLayout(false)}
                    >
                      <Monitor className="size-3" />
                      Desktop
                    </Button>
                    <Button
                      variant={editingMobileLayout ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => setEditingMobileLayout(true)}
                    >
                      <Smartphone className="size-3" />
                      Mobile
                    </Button>
                  </div>
                )}
              </div>
            </DialogHeader>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* Bouton mobile pour afficher les widgets */}
              <div className="md:hidden p-2 border-b bg-muted/30 flex gap-2">
                <Button 
                  variant={showMobileWidgetPanel ? "default" : "outline"} 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setShowMobileWidgetPanel(!showMobileWidgetPanel)}
                >
                  <Plus className="size-4 mr-2" />
                  {showMobileWidgetPanel ? "Masquer widgets" : "Ajouter widget"}
                </Button>
                {editingWidget && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setEditingWidget(null)
                      setEditWidgetType(null)
                    }}
                  >
                    <X className="size-4 mr-1" />
                    Fermer
                  </Button>
                )}
              </div>

              {/* Panneau mobile - Widgets disponibles (collapsible) */}
              {showMobileWidgetPanel && (
                <div className="md:hidden max-h-[200px] border-b bg-muted/30 p-3 overflow-y-auto">
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(WIDGET_LABELS).map(([type, config]) => {
                      const Icon = config.icon
                      const isUsed = currentEditorWidgets.some((w) => w.type === type && w.enabled)
                      return (
                        <div
                          key={type}
                          onClick={() => {
                            if (gridSelectionStart && gridSelectionEnd) {
                              addWidgetToGrid(type as WidgetType)
                              setShowMobileWidgetPanel(false)
                            } else {
                              setSelectedWidgetType(type as WidgetType)
                            }
                          }}
                          className={cn(
                            "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                            "hover:border-primary/50 hover:bg-background",
                            isUsed && "opacity-50",
                            selectedWidgetType === type && "border-primary bg-primary/10"
                          )}
                        >
                          <div className={cn(
                            "p-1.5 rounded-md",
                            isUsed ? "bg-muted" : "bg-primary/10"
                          )}>
                            <Icon className={cn("size-4", isUsed ? "text-muted-foreground" : "text-primary")} />
                          </div>
                          <p className="text-[10px] font-medium text-center leading-tight">{config.label}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Panneau de gauche - Widgets disponibles (desktop) */}
              <div className="hidden md:block w-56 lg:w-64 border-r bg-muted/30 p-3 lg:p-4 overflow-y-auto shrink-0">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Plus className="size-4" />
                  Widgets disponibles
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Glissez un widget sur la grille ou sélectionnez des cellules
                </p>

                <div className="space-y-2">
                  {Object.entries(
                    Object.entries(WIDGET_LABELS).reduce((acc, [type, config]) => {
                      const category = config.category || "Autre"
                      if (!acc[category]) acc[category] = []
                      acc[category].push([type, config])
                      return acc
                    }, {} as Record<string, [string, typeof WIDGET_LABELS[WidgetType]][]>)
                  ).map(([category, categoryWidgets]) => (
                    <div key={category} className="mb-4">
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        {category}
                      </h4>
                      <div className="space-y-1">
                        {categoryWidgets.map(([type, config]) => {
                          const Icon = config.icon
                          const isUsed = currentEditorWidgets.some((w) => w.type === type && w.enabled)
                          return (
                            <div
                              key={type}
                              draggable
                              onDragStart={() => setDraggedAvailableWidget(type as WidgetType)}
                              onDragEnd={() => setDraggedAvailableWidget(null)}
                              onClick={() => {
                                if (gridSelectionStart && gridSelectionEnd) {
                                  addWidgetToGrid(type as WidgetType)
                                } else {
                                  setSelectedWidgetType(type as WidgetType)
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all",
                                "hover:border-primary/50 hover:bg-background",
                                isUsed && "opacity-50",
                                selectedWidgetType === type && "border-primary bg-primary/10",
                                draggedAvailableWidget === type && "opacity-50 scale-95"
                              )}
                            >
                              <div className={cn(
                                "p-1.5 rounded-md",
                                isUsed ? "bg-muted" : "bg-primary/10"
                              )}>
                                <Icon className={cn("size-3.5", isUsed ? "text-muted-foreground" : "text-primary")} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{config.label}</p>
                              </div>
                              {isUsed && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0">Utilisé</Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zone centrale - Grille dynamique */}
              <div className="flex-1 p-2 sm:p-4 md:p-6 flex flex-col items-center bg-background overflow-auto">
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  <div className="mb-2 sm:mb-4 text-center">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {draggingEditorWidget ? (
                        <span className="text-primary font-medium">
                          Déposez le widget sur une cellule verte disponible
                        </span>
                      ) : gridSelectionStart && gridSelectionEnd ? (
                        <>
                          Sélection: {Math.abs(gridSelectionEnd.col - gridSelectionStart.col) + 1} × {Math.abs(gridSelectionEnd.row - gridSelectionStart.row) + 1}
                          {selectedWidgetType ? (
                            <span className="ml-2 text-primary hidden sm:inline">
                              — Cliquez sur un widget pour l&apos;ajouter
                            </span>
                          ) : (
                            <span className="ml-2 hidden sm:inline">
                              — Sélectionnez un widget
                            </span>
                          )}
                        </>
                      ) : draggedAvailableWidget ? (
                        "Déposez le widget sur une cellule vide"
                      ) : (
                        <span className="hidden sm:inline">
                          {editingMobileLayout ? "Grille mobile 2×6 - " : "Grille desktop 4×4 - "}
                          Glissez un widget pour le déplacer, ou sélectionnez des cellules
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Grille dynamique (2x6 mobile ou 4x4 desktop) */}
                  <div 
                    className={cn(
                      "grid gap-2 p-2 sm:p-3 md:p-4 rounded-xl border-2 transition-all mx-auto",
                      editingMobileLayout ? "grid-cols-2 grid-rows-6" : "grid-cols-4 grid-rows-4",
                      editingMobileLayout 
                        ? "w-[160px] h-[480px] sm:w-[180px] sm:h-[540px]" 
                        : "w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] md:w-[420px] md:h-[420px]",
                      draggingEditorWidget || draggedAvailableWidget 
                        ? "bg-muted/40 border-primary/30" 
                        : "bg-muted/20 border-dashed",
                      resizingWidget && "cursor-grabbing"
                    )}
                  onMouseLeave={() => {
                    setHoveredCell(null)
                    if (resizingWidget) handleResizeEnd()
                  }}
                  onMouseUp={(e) => {
                    handleGridCellMouseUp()
                    if (resizingWidget) handleResizeEnd()
                  }}
                  onMouseMove={resizingWidget ? handleResizeMove : undefined}
                >
                  {Array.from({ length: gridRows }).map((_, rowIndex) =>
                    Array.from({ length: gridCols }).map((_, colIndex) => {
                      const grid = getGridOccupancy()
                      const widgetId = grid[rowIndex][colIndex]
                      const widget = widgetId ? currentEditorWidgets.find(w => w.id === widgetId) : null
                      const isWidgetOrigin = widget && widget.row === rowIndex && widget.col === colIndex
                      const inSelection = isInSelection(rowIndex, colIndex)
                      const isHovered = hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex
                      const isDragging = draggingEditorWidget || draggedAvailableWidget
                      const canDropHere = canDropWidgetAt(rowIndex, colIndex)
                      const isBeingDragged = widget && draggingEditorWidget === widget.id

                      // Si c'est une cellule occupée mais pas l'origine, on la cache
                      if (widgetId && !isWidgetOrigin) {
                        return <div key={`${rowIndex}-${colIndex}`} className="hidden" />
                      }

                      // Si c'est l'origine d'un widget
                      if (isWidgetOrigin && widget) {
                        const config = WIDGET_LABELS[widget.type]
                        const Icon = config.icon
                        return (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move"
                              setDraggingEditorWidget(widget.id)
                              setEditingWidget(null)
                            }}
                            onDragEnd={() => setDraggingEditorWidget(null)}
                            className={cn(
                              "relative rounded-lg border-2 bg-card shadow-sm transition-all group",
                              "hover:border-primary hover:shadow-md cursor-grab active:cursor-grabbing",
                              editingWidget === widget.id && "border-primary ring-2 ring-primary/20",
                              isBeingDragged && "opacity-30 scale-95"
                            )}
                            style={{
                              gridColumn: `span ${widget.width}`,
                              gridRow: `span ${widget.height}`,
                            }}
                            onClick={() => {
                              if (!draggingEditorWidget) {
                                setEditingWidget(widget.id)
                                setEditWidgetType(widget.type)
                              }
                            }}
                          >
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                              <Icon className="size-6 text-primary mb-1" />
                              <p className="text-xs font-medium text-center leading-tight">{config.label}</p>
                              <p className="text-[10px] text-muted-foreground">{widget.width}×{widget.height}</p>
                            </div>
                            
                            {/* Bouton supprimer */}
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 size-6 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeWidgetFromGrid(widget.id)
                              }}
                            >
                              <X className="size-3" />
                            </Button>

                            {/* Poignées de redimensionnement style épuré */}
                            <>
                              {/* Handle droite */}
                              {widget.width > 1 || (widget.width < gridCols && widget.col! + widget.width < gridCols) ? (
                                <div
                                  className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 cursor-ew-resize bg-primary/0 hover:bg-primary/80 transition-all opacity-0 group-hover:opacity-100 z-20"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    handleResizeStart(e, widget.id, "right")
                                  }}
                                  title="Redimensionner"
                                >
                                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-full" />
                                </div>
                              ) : null}
                              
                              {/* Handle gauche */}
                              {widget.width > 1 || (widget.width < gridCols && widget.col! > 0) ? (
                                <div
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 cursor-ew-resize bg-primary/0 hover:bg-primary/80 transition-all opacity-0 group-hover:opacity-100 z-20"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    handleResizeStart(e, widget.id, "left")
                                  }}
                                  title="Redimensionner"
                                >
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-full" />
                                </div>
                              ) : null}
                              
                              {/* Handle bas */}
                              {widget.height > 1 || (widget.height < (editingMobileLayout ? 6 : 2) && widget.row! + widget.height < gridRows) ? (
                                <div
                                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-8 cursor-ns-resize bg-primary/0 hover:bg-primary/80 transition-all opacity-0 group-hover:opacity-100 z-20"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    handleResizeStart(e, widget.id, "bottom")
                                  }}
                                  title="Redimensionner"
                                >
                                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-6 bg-primary rounded-full" />
                                </div>
                              ) : null}
                              
                              {/* Handle haut */}
                              {widget.height > 1 || (widget.height < (editingMobileLayout ? 6 : 2) && widget.row! > 0) ? (
                                <div
                                  className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-8 cursor-ns-resize bg-primary/0 hover:bg-primary/80 transition-all opacity-0 group-hover:opacity-100 z-20"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    handleResizeStart(e, widget.id, "top")
                                  }}
                                  title="Redimensionner"
                                >
                                  <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 bg-primary rounded-full" />
                                </div>
                              ) : null}
                              
                              {/* Handle coin bas-droite */}
                              {(widget.width < gridCols && widget.col! + widget.width < gridCols) || (widget.height < (editingMobileLayout ? 6 : 2) && widget.row! + widget.height < gridRows) ? (
                                <div
                                  className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    handleResizeStart(e, widget.id, "corner")
                                  }}
                                  title="Redimensionner"
                                >
                                  <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-primary rounded-br" />
                                </div>
                              ) : null}
                            </>
                          </div>
                        )
                      }

                      // Cellule vide
                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={cn(
                            "rounded-lg border-2 border-dashed transition-all flex items-center justify-center",
                            "aspect-square w-full",
                            // Quand on déplace un widget, montrer les zones valides/invalides
                            isDragging && canDropHere && "bg-green-500/20 border-green-500 border-solid",
                            isDragging && !canDropHere && widgetId && "bg-red-500/10 border-red-300",
                            isDragging && !canDropHere && !widgetId && "bg-muted/30 border-muted-foreground/10",
                            isDragging && canDropHere && isHovered && "bg-green-500/40 border-green-600 scale-105",
                            // Mode normal (pas de drag)
                            !isDragging && inSelection && "bg-primary/20 border-primary",
                            !isDragging && !inSelection && isHovered && "bg-muted/50 border-muted-foreground/30",
                            !isDragging && !inSelection && !isHovered && "border-muted-foreground/20"
                          )}
                          onMouseDown={() => !isDragging && handleGridCellMouseDown(rowIndex, colIndex)}
                          onMouseEnter={() => handleGridCellMouseEnter(rowIndex, colIndex)}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setHoveredCell({ row: rowIndex, col: colIndex })
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            handleDropOnGrid(rowIndex, colIndex)
                          }}
                        >
                          {isDragging && canDropHere ? (
                            <Plus className="size-5 text-green-600" />
                          ) : !widgetId && !isDragging ? (
                            <span className="text-[10px] text-muted-foreground/50">
                              {rowIndex + 1},{colIndex + 1}
                            </span>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Légende */}
                <div className="mt-2 sm:mt-4 flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground justify-center">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="size-2 sm:size-3 rounded border-2 border-dashed border-muted-foreground/20" />
                    <span>Vide</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="size-2 sm:size-3 rounded bg-green-500/20 border-2 border-green-500" />
                    <span>Disponible</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="size-2 sm:size-3 rounded bg-card border-2 border-border" />
                    <span>Widget</span>
                  </div>
                </div>
                </div>
              </div>

              {/* Panneau de droite - Propriétés du widget sélectionné (desktop) */}
              {editingWidget && (
                <div className="hidden md:block w-48 lg:w-56 border-l bg-muted/30 p-3 lg:p-4 overflow-y-auto shrink-0">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Edit3 className="size-4" />
                    Modifier le widget
                  </h3>

                  {(() => {
                    const widget = editorWidgets.find(w => w.id === editingWidget)
                    if (!widget) return null
                    const config = WIDGET_LABELS[widget.type]
                    const Icon = config.icon

                    return (
                      <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-background border">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="size-5 text-primary" />
                            <p className="text-sm font-medium">{config.label}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                          <div className="mt-2 text-xs">
                            <Badge variant="outline">{widget.width}×{widget.height}</Badge>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium mb-2">Changer le type</p>
                          <Select
                            value={widget.type}
                            onValueChange={(value) => updateWidgetInGrid(editingWidget, value as WidgetType)}
                          >
                            <SelectTrigger className="text-xs h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(WIDGET_LABELS).map(([type, cfg]) => (
                                <SelectItem key={type} value={type} className="text-xs">
                                  {cfg.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => removeWidgetFromGrid(editingWidget)}
                        >
                          <Trash2 className="size-3 mr-2" />
                          Supprimer
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setEditingWidget(null)
                            setEditWidgetType(null)
                          }}
                        >
                          Fermer
                        </Button>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 sm:p-4 border-t bg-muted/30 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 shrink-0">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none text-xs sm:text-sm"
                  onClick={() => {
                    const defaultWidgets: DashboardWidget[] = [
                      { id: "1", type: "routine-progress", enabled: true, order: 0, width: 1, height: 1, row: 0, col: 0 },
                      { id: "2", type: "missions-stats", enabled: true, order: 1, width: 1, height: 1, row: 0, col: 1 },
                      { id: "3", type: "tasks-stats", enabled: true, order: 2, width: 1, height: 1, row: 0, col: 2 },
                      { id: "4", type: "projects-stats", enabled: true, order: 3, width: 1, height: 1, row: 0, col: 3 },
                      { id: "5", type: "routine-list", enabled: true, order: 4, width: 2, height: 1, row: 1, col: 0 },
                      { id: "6", type: "today-missions", enabled: true, order: 5, width: 2, height: 1, row: 1, col: 2 },
                      { id: "7", type: "week-missions", enabled: true, order: 6, width: 2, height: 1, row: 2, col: 0 },
                      { id: "8", type: "active-projects", enabled: true, order: 7, width: 2, height: 1, row: 2, col: 2 },
                    ]
                    setCurrentEditorWidgets(defaultWidgets)
                  }}
                >
                  <RotateCcw className="size-3 mr-1 sm:mr-2" />
                  <span className="hidden xs:inline">Réinitialiser</span>
                  <span className="xs:hidden">Reset</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none text-xs sm:text-sm"
                  onClick={() => setCurrentEditorWidgets([])}
                >
                  <Trash2 className="size-3 mr-1 sm:mr-2" />
                  <span className="hidden xs:inline">Tout effacer</span>
                  <span className="xs:hidden">Effacer</span>
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={closeGridEditor}>
                  Annuler
                </Button>
                <Button size="sm" className="flex-1 sm:flex-none" onClick={applyGridChanges}>
                  <CheckCircle2 className="size-3 sm:size-4 mr-1 sm:mr-2" />
                  Appliquer
                </Button>
              </div>
            </div>
          </div>
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
