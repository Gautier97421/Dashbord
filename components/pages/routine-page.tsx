"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  Flame,
  Trophy,
  Calendar,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from "lucide-react"
import { useApp } from "@/lib/store-api"
import { generateId, getToday, formatDateFr, calculateStreak } from "@/lib/helpers"
import type { RoutineAction, RoutineCategory, Priority } from "@/lib/types"
import { cn } from "@/lib/utils"

const CATEGORIES: { value: RoutineCategory; label: string }[] = [
  { value: "health", label: "Santé" },
  { value: "sport", label: "Sport" },
  { value: "mental", label: "Mental" },
  { value: "work", label: "Travail" },
  { value: "personal", label: "Personnel" },
]

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Basse" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
]

export function RoutinePage() {
  const { state, dispatch, addRoutineAction, updateRoutineAction, deleteRoutineAction, logRoutine } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<RoutineAction | null>(null)
  const [newAction, setNewAction] = useState<Partial<RoutineAction>>({
    name: "",
    category: "personal",
    importance: "medium",
  })
  const [selectedWeek, setSelectedWeek] = useState(0) // 0 = current week
  const [draggedAction, setDraggedAction] = useState<string | null>(null)
  const [dragOverAction, setDragOverAction] = useState<string | null>(null)

  const today = getToday()

  const todayLogs = useMemo(() => {
    return state.routineLogs.filter((l) => l.date === today)
  }, [state.routineLogs, today])

  const routineProgress = useMemo(() => {
    const total = state.routineActions.length
    if (total === 0) return 0
    const completed = todayLogs.filter((l) => l.completed).length
    return Math.round((completed / total) * 100)
  }, [state.routineActions.length, todayLogs])

  // Get week dates for the calendar view
  const weekDates = useMemo(() => {
    const dates: Date[] = []
    const current = new Date()
    current.setDate(current.getDate() + selectedWeek * 7)

    const dayOfWeek = current.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    for (let i = 0; i < 7; i++) {
      const date = new Date(current)
      date.setDate(current.getDate() + diff + i)
      dates.push(date)
    }

    return dates
  }, [selectedWeek])

  const toggleRoutine = async (actionId: string, date?: string) => {
    const targetDate = date || today
    const existingLog = state.routineLogs.find(
      (l) => l.actionId === actionId && l.date === targetDate
    )

    await logRoutine(actionId, targetDate, !existingLog?.completed)
  }

  const handleSaveAction = async () => {
    if (!newAction.name) return

    if (editingAction) {
      await updateRoutineAction({
        ...editingAction,
        name: newAction.name!,
        category: newAction.category!,
        importance: newAction.importance!,
      })
    } else {
      await addRoutineAction({
        name: newAction.name!,
        category: newAction.category!,
        importance: newAction.importance!,
      })
    }

    setNewAction({ name: "", category: "personal", importance: "medium" })
    setEditingAction(null)
    setIsDialogOpen(false)
  }

  const handleDeleteAction = async (id: string) => {
    await deleteRoutineAction(id)
  }

  const handleDragStart = (e: React.DragEvent, actionId: string) => {
    setDraggedAction(actionId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, actionId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverAction(actionId)
  }

  const handleDragEnd = () => {
    setDraggedAction(null)
    setDragOverAction(null)
  }

  const handleDrop = (e: React.DragEvent, targetActionId: string) => {
    e.preventDefault()
    
    if (!draggedAction || draggedAction === targetActionId) {
      setDraggedAction(null)
      setDragOverAction(null)
      return
    }

    const draggedIndex = state.routineActions.findIndex((a) => a.id === draggedAction)
    const targetIndex = state.routineActions.findIndex((a) => a.id === targetActionId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newActions = [...state.routineActions]
    const [removed] = newActions.splice(draggedIndex, 1)
    newActions.splice(targetIndex, 0, removed)

    dispatch({ type: "REORDER_ROUTINE_ACTIONS", payload: newActions })
    setDraggedAction(null)
    setDragOverAction(null)
  }

  const openEditDialog = (action: RoutineAction) => {
    setEditingAction(action)
    setNewAction({
      name: action.name,
      category: action.category,
      importance: action.importance,
    })
    setIsDialogOpen(true)
  }

  const getCategoryColor = (category: RoutineCategory) => {
    const colors: Record<RoutineCategory, string> = {
      health: "bg-green-500/10 text-green-600 border-green-500/30",
      sport: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      mental: "bg-purple-500/10 text-purple-600 border-purple-500/30",
      work: "bg-orange-500/10 text-orange-600 border-orange-500/30",
      personal: "bg-pink-500/10 text-pink-600 border-pink-500/30",
    }
    return colors[category]
  }

  const isLoggedForDate = (actionId: string, date: string) => {
    return state.routineLogs.some((l) => l.actionId === actionId && l.date === date && l.completed)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Routine matinale</h1>
          <p className="text-muted-foreground">Construisez vos habitudes, une action à la fois</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setEditingAction(null)
            setNewAction({ name: "", category: "personal", importance: "medium" })
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Ajouter une action
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAction ? "Modifier l'action" : "Nouvelle action"}</DialogTitle>
              <DialogDescription>
                {editingAction
                  ? "Modifiez les détails de cette action"
                  : "Ajoutez une nouvelle action à votre routine matinale"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nom de l&apos;action</Label>
                <Input
                  id="name"
                  placeholder="Ex: Méditation 10 min"
                  value={newAction.name}
                  onChange={(e) => setNewAction({ ...newAction, name: e.target.value })}
                />
              </div>

              <div>
                <Label>Catégorie</Label>
                <Select
                  value={newAction.category}
                  onValueChange={(value: RoutineCategory) =>
                    setNewAction({ ...newAction, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Importance</Label>
                <Select
                  value={newAction.importance}
                  onValueChange={(value: Priority) =>
                    setNewAction({ ...newAction, importance: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveAction} disabled={!newAction.name}>
                {editingAction ? "Enregistrer" : "Ajouter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Today's Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Aujourd&apos;hui - {formatDateFr(today, "full")}
          </CardTitle>
          <CardDescription>
            {todayLogs.filter((l) => l.completed).length} / {state.routineActions.length} actions complétées
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={routineProgress} className="h-3 mb-6" />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.routineActions.map((action) => {
              const log = todayLogs.find((l) => l.actionId === action.id)
              const isCompleted = log?.completed || false
              const streak = calculateStreak(state.routineLogs, action.id)

              return (
                <div
                  key={action.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, action.id)}
                  onDragOver={(e) => handleDragOver(e, action.id)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, action.id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-4 transition-all cursor-move",
                    isCompleted && "bg-success/5 border-success/30",
                    draggedAction === action.id && "opacity-50",
                    dragOverAction === action.id && "border-primary border-2"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="size-5 text-muted-foreground" />
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={() => toggleRoutine(action.id)}
                      className="size-5"
                    />
                    <div>
                      <p className={cn(
                        "font-medium",
                        isCompleted && "text-muted-foreground line-through"
                      )}>
                        {action.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={getCategoryColor(action.category)}>
                          {CATEGORIES.find((c) => c.value === action.category)?.label}
                        </Badge>
                        {streak.current > 0 && (
                          <div className="flex items-center gap-1 text-orange-500">
                            <Flame className="size-3" />
                            <span className="text-xs font-medium">{streak.current}j</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditDialog(action)
                      }}
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteAction(action.id)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {state.routineActions.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Aucune action dans votre routine. Commencez par en ajouter une !
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabs for History and Stats */}
      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">Calendrier</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Historique de la semaine</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedWeek((prev) => prev - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[140px] text-center">
                  {selectedWeek === 0
                    ? "Cette semaine"
                    : selectedWeek === -1
                      ? "Semaine dernière"
                      : formatDateFr(weekDates[0], "short") + " - " + formatDateFr(weekDates[6], "short")}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedWeek((prev) => Math.min(prev + 1, 0))}
                  disabled={selectedWeek >= 0}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-2 font-medium text-muted-foreground">Action</th>
                      {weekDates.map((date) => {
                        const dateStr = date.toISOString().split("T")[0]
                        const isToday = dateStr === today
                        return (
                          <th
                            key={dateStr}
                            className={cn(
                              "p-2 text-center font-medium min-w-[60px]",
                              isToday && "text-primary"
                            )}
                          >
                            <div className="text-xs text-muted-foreground">
                              {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][date.getDay()]}
                            </div>
                            <div className={cn("text-sm", isToday && "text-primary font-bold")}>
                              {date.getDate()}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {state.routineActions.map((action) => (
                      <tr key={action.id} className="border-t">
                        <td className="p-2">
                          <span className="text-sm font-medium">{action.name}</span>
                        </td>
                        {weekDates.map((date) => {
                          const dateStr = date.toISOString().split("T")[0]
                          const isLogged = isLoggedForDate(action.id, dateStr)
                          const isPast = dateStr < today
                          const isToday = dateStr === today

                          return (
                            <td key={dateStr} className="p-2 text-center">
                              <button
                                onClick={() => toggleRoutine(action.id, dateStr)}
                                disabled={dateStr > today}
                                className={cn(
                                  "size-8 rounded-full flex items-center justify-center mx-auto transition-colors",
                                  isLogged && "bg-success text-success-foreground",
                                  !isLogged && isPast && "bg-destructive/20 text-destructive",
                                  !isLogged && isToday && "bg-muted hover:bg-muted/80",
                                  dateStr > today && "opacity-30 cursor-not-allowed"
                                )}
                              >
                                {isLogged ? "✓" : isPast ? "✗" : "○"}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats View */}
        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Statistiques globales</CardTitle>
              <CardDescription>Vue d&apos;ensemble de votre progression</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-primary">
                    {state.routineLogs.filter((l) => l.completed).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Actions complétées</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-success">
                    {Math.max(...state.routineActions.map((a) => calculateStreak(state.routineLogs, a.id).longest), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Plus longue série</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-orange-500">
                    {state.routineActions.filter((a) => calculateStreak(state.routineLogs, a.id).current > 0).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Séries actives</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold">
                    {state.routineActions.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Actions dans la routine</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
