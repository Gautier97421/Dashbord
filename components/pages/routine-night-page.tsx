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
  Moon,
  GripVertical,
} from "lucide-react"
import { useApp } from "@/lib/store-api"
import { generateId, getToday, formatDateFr, calculateStreak } from "@/lib/helpers"
import type { NightRoutineAction, Priority } from "@/lib/types"
import { cn } from "@/lib/utils"

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Basse" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
]

export function RoutineNightPage() {
  const { state, dispatch, addNightRoutineAction, updateNightRoutineAction, deleteNightRoutineAction, logNightRoutine } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<NightRoutineAction | null>(null)
  const [newAction, setNewAction] = useState<Partial<NightRoutineAction>>({
    name: "",
    importance: "medium",
  })
  const [selectedWeek, setSelectedWeek] = useState(0) // 0 = current week
  const [draggedAction, setDraggedAction] = useState<string | null>(null)
  const [dragOverAction, setDragOverAction] = useState<string | null>(null)

  const today = getToday()

  const todayLogs = useMemo(() => {
    return state.nightRoutineLogs.filter((l) => l.date === today)
  }, [state.nightRoutineLogs, today])

  const routineProgress = useMemo(() => {
    const total = state.nightRoutineActions?.length || 0
    if (total === 0) return 0
    const completed = todayLogs.filter((l) => l.completed).length
    return Math.round((completed / total) * 100)
  }, [state.nightRoutineActions, todayLogs])

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
    const existingLog = state.nightRoutineLogs.find(
      (l) => l.actionId === actionId && l.date === targetDate
    )

    await logNightRoutine(actionId, targetDate, !existingLog?.completed)
  }

  const handleSaveAction = async () => {
    if (!newAction.name) return

    if (editingAction) {
      await updateNightRoutineAction({
        ...editingAction,
        name: newAction.name!,
        importance: newAction.importance!,
      })
    } else {
      await addNightRoutineAction({
        name: newAction.name!,
        importance: newAction.importance!,
      })
    }

    setNewAction({ name: "", importance: "medium" })
    setEditingAction(null)
    setIsDialogOpen(false)
  }

  const handleDeleteAction = async (id: string) => {
    await deleteNightRoutineAction(id)
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

    const draggedIndex = state.nightRoutineActions.findIndex((a) => a.id === draggedAction)
    const targetIndex = state.nightRoutineActions.findIndex((a) => a.id === targetActionId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newActions = [...state.nightRoutineActions]
    const [removed] = newActions.splice(draggedIndex, 1)
    newActions.splice(targetIndex, 0, removed)

    dispatch({ type: "REORDER_NIGHT_ROUTINE_ACTIONS", payload: newActions })
    setDraggedAction(null)
    setDragOverAction(null)
  }

  const openEditDialog = (action: NightRoutineAction) => {
    setEditingAction(action)
    setNewAction({
      name: action.name,
      importance: action.importance,
    })
    setIsDialogOpen(true)
  }

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
      case "medium":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"
      case "low":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Routine du soir</h1>
          <p className="text-sm text-muted-foreground">Terminez votre journée en beauté</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="sm:size-default w-full sm:w-auto" onClick={() => { setEditingAction(null); setNewAction({ name: "", importance: "medium" }) }}>
              <Plus className="size-4 mr-2" />
              Ajouter une action
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAction ? "Modifier l'action" : "Nouvelle action"}
              </DialogTitle>
              <DialogDescription>
                Ajoutez une nouvelle action à votre routine du soir
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Nom de l'action</Label>
                <Input
                  id="name"
                  placeholder="Ex: Préparer les affaires du lendemain"
                  value={newAction.name || ""}
                  onChange={(e) => setNewAction({ ...newAction, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="importance">Importance</Label>
                <Select
                  value={newAction.importance || "medium"}
                  onValueChange={(value: Priority) => setNewAction({ ...newAction, importance: value })}
                >
                  <SelectTrigger id="importance">
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
            {todayLogs.filter((l) => l.completed).length} / {state.nightRoutineActions?.length || 0} actions complétées
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={routineProgress} className="h-3 mb-6" />

          {(!state.nightRoutineActions || state.nightRoutineActions.length === 0) ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setIsDialogOpen(true)}>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                  <Plus className="size-6 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Lecture 20min</p>
                </CardContent>
              </Card>
              <Card className="border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setIsDialogOpen(true)}>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                  <Plus className="size-6 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Préparer le lendemain</p>
                </CardContent>
              </Card>
              <Card className="border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setIsDialogOpen(true)}>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                  <Plus className="size-6 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Étirements</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(state.nightRoutineActions || []).map((action) => {
              const log = todayLogs.find((l) => l.actionId === action.id)
              const isCompleted = log?.completed || false
              const streak = calculateStreak(state.nightRoutineLogs, action.id)

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
                        <Badge variant="outline" className={getPriorityColor(action.importance)}>
                          {PRIORITIES.find((c) => c.value === action.importance)?.label}
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
                    {(state.nightRoutineActions || []).map((action) => (
                      <tr key={action.id} className="border-t">
                        <td className="p-2">
                          <span className="text-sm font-medium">{action.name}</span>
                        </td>
                        {weekDates.map((date) => {
                          const dateStr = date.toISOString().split("T")[0]
                          const isLogged = state.nightRoutineLogs.some(
                            (l) => l.actionId === action.id && l.date === dateStr && l.completed
                          )
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
                    {state.nightRoutineLogs.filter((l) => l.completed).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Actions complétées</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-success">
                    {state.nightRoutineActions?.length ? Math.max(...state.nightRoutineActions.map((a) => calculateStreak(state.nightRoutineLogs, a.id).longest), 0) : 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Plus longue série</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-orange-500">
                    {(state.nightRoutineActions || []).filter((a) => calculateStreak(state.nightRoutineLogs, a.id).current > 0).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Séries actives</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold">
                    {state.nightRoutineActions?.length || 0}
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
