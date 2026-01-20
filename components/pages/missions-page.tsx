"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Edit,
  ChevronRight,
} from "lucide-react"
import { useApp } from "@/lib/store-api"
import { generateId, formatDateFr } from "@/lib/helpers"
import type { Mission, Task, TimeFrame, Priority, TaskStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const TIME_FRAMES: { value: TimeFrame; label: string }[] = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
  { value: "year", label: "Année" },
]

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Basse", color: "bg-muted text-muted-foreground" },
  { value: "medium", label: "Moyenne", color: "bg-primary/20 text-primary" },
  { value: "high", label: "Haute", color: "bg-destructive/20 text-destructive" },
]

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "À faire" },
  { value: "in-progress", label: "En cours" },
  { value: "done", label: "Terminé" },
]

export function MissionsPage() {
  const { state, addMission, updateMission, deleteMission } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMission, setEditingMission] = useState<Mission | null>(null)
  const [activeTimeFrame, setActiveTimeFrame] = useState<TimeFrame>("day")
  const [newMission, setNewMission] = useState<Partial<Mission>>({
    title: "",
    description: "",
    timeFrame: "day",
    priority: "medium",
    status: "todo",
    tasks: [],
  })
  const [newSubtask, setNewSubtask] = useState("")

  const missionsByTimeFrame = useMemo(() => {
    return {
      day: state.missions.filter((m) => m.timeFrame === "day"),
      week: state.missions.filter((m) => m.timeFrame === "week"),
      month: state.missions.filter((m) => m.timeFrame === "month"),
      year: state.missions.filter((m) => m.timeFrame === "year"),
    }
  }, [state.missions])

  const handleSaveMission = async () => {
    if (!newMission.title) return

    if (editingMission) {
      await updateMission({
        ...editingMission,
        title: newMission.title!,
        description: newMission.description,
        timeFrame: newMission.timeFrame!,
        priority: newMission.priority!,
        status: newMission.status!,
        tasks: newMission.tasks || [],
      })
    } else {
      await addMission({
        title: newMission.title!,
        description: newMission.description,
        timeFrame: newMission.timeFrame!,
        priority: newMission.priority!,
        status: newMission.status!,
        tasks: newMission.tasks || [],
        dueDate: new Date().toISOString().split('T')[0],
      })
    }

    resetForm()
  }

  const resetForm = () => {
    setNewMission({
      title: "",
      description: "",
      timeFrame: activeTimeFrame,
      priority: "medium",
      status: "todo",
      tasks: [],
    })
    setEditingMission(null)
    setIsDialogOpen(false)
    setNewSubtask("")
  }

  const openEditDialog = (mission: Mission) => {
    setEditingMission(mission)
    setNewMission({
      title: mission.title,
      description: mission.description,
      timeFrame: mission.timeFrame,
      priority: mission.priority,
      status: mission.status,
      tasks: mission.tasks,
    })
    setIsDialogOpen(true)
  }

  const handleDeleteMission = async (id: string) => {
    await deleteMission(id)
  }

  const updateMissionStatus = async (mission: Mission, status: TaskStatus) => {
    await updateMission({
      ...mission,
      status,
      completedAt: status === "done" ? new Date().toISOString() : undefined,
    })
  }

  const addSubtask = () => {
    if (!newSubtask.trim()) return

    const subtask: Task = {
      id: generateId(),
      title: newSubtask,
      priority: "medium",
      status: "todo",
      createdAt: new Date().toISOString(),
    }

    setNewMission({
      ...newMission,
      tasks: [...(newMission.tasks || []), subtask],
    })
    setNewSubtask("")
  }

  const removeSubtask = (taskId: string) => {
    setNewMission({
      ...newMission,
      tasks: (newMission.tasks || []).filter((t) => t.id !== taskId),
    })
  }

  const toggleSubtaskInMission = async (mission: Mission, taskId: string) => {
    const updatedTasks = mission.tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: t.status === "done" ? "todo" : "done" as TaskStatus }
        : t
    )

    await updateMission({ ...mission, tasks: updatedTasks })
  }

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="size-5 text-success" />
      case "in-progress":
        return <Clock className="size-5 text-primary" />
      default:
        return <Circle className="size-5 text-muted-foreground" />
    }
  }

  const getMissionProgress = (mission: Mission) => {
    if (mission.tasks.length === 0) return mission.status === "done" ? 100 : 0
    const completed = mission.tasks.filter((t) => t.status === "done").length
    return Math.round((completed / mission.tasks.length) * 100)
  }

  const renderMissionCard = (mission: Mission) => (
    <Card key={mission.id} className={cn(mission.status === "done" && "opacity-60")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <button onClick={() => updateMissionStatus(
              mission,
              mission.status === "done" ? "todo" : "done"
            )}>
              {getStatusIcon(mission.status)}
            </button>
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "font-medium",
                mission.status === "done" && "line-through text-muted-foreground"
              )}>
                {mission.title}
              </h3>
              {mission.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {mission.description}
                </p>
              )}

              {/* Subtasks */}
              {mission.tasks.length > 0 && (
                <div className="mt-3 space-y-1">
                  {mission.tasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <button
                        onClick={() => toggleSubtaskInMission(mission, task.id)}
                        className="shrink-0"
                      >
                        {task.status === "done" ? (
                          <CheckCircle2 className="size-4 text-success" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground" />
                        )}
                      </button>
                      <span className={task.status === "done" ? "line-through text-muted-foreground" : ""}>
                        {task.title}
                      </span>
                    </div>
                  ))}
                  {mission.tasks.length > 3 && (
                    <p className="text-xs text-muted-foreground ml-6">
                      +{mission.tasks.length - 3} autres tâches
                    </p>
                  )}
                </div>
              )}

              {/* Progress bar */}
              {mission.tasks.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Progression</span>
                    <span>{getMissionProgress(mission)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${getMissionProgress(mission)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3">
                <Badge
                  variant="outline"
                  className={PRIORITIES.find((p) => p.value === mission.priority)?.color}
                >
                  {PRIORITIES.find((p) => p.value === mission.priority)?.label}
                </Badge>
                {mission.dueDate && (
                  <Badge variant="secondary">
                    {formatDateFr(mission.dueDate, "short")}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => updateMissionStatus(mission, "todo")}>
                <Circle className="size-4 mr-2" />
                À faire
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMissionStatus(mission, "in-progress")}>
                <Clock className="size-4 mr-2" />
                En cours
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMissionStatus(mission, "done")}>
                <CheckCircle2 className="size-4 mr-2" />
                Terminé
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openEditDialog(mission)}>
                <Edit className="size-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteMission(mission.id)}
                className="text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Missions</h1>
          <p className="text-muted-foreground">Organisez vos objectifs par période</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm()
          else setNewMission({ ...newMission, timeFrame: activeTimeFrame })
          setIsDialogOpen(open)
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Nouvelle mission
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingMission ? "Modifier la mission" : "Nouvelle mission"}</DialogTitle>
              <DialogDescription>
                {editingMission
                  ? "Modifiez les détails de cette mission"
                  : "Définissez un objectif clair et atteignable"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label htmlFor="title">Titre</Label>
                <Input
                  id="title"
                  placeholder="Ex: Finaliser le rapport trimestriel"
                  value={newMission.title}
                  onChange={(e) => setNewMission({ ...newMission, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="description">Description (optionnel)</Label>
                <Textarea
                  id="description"
                  placeholder="Détails supplémentaires..."
                  value={newMission.description || ""}
                  onChange={(e) => setNewMission({ ...newMission, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Période</Label>
                  <Select
                    value={newMission.timeFrame}
                    onValueChange={(value: TimeFrame) =>
                      setNewMission({ ...newMission, timeFrame: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_FRAMES.map((tf) => (
                        <SelectItem key={tf.value} value={tf.value}>
                          {tf.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Priorité</Label>
                  <Select
                    value={newMission.priority}
                    onValueChange={(value: Priority) =>
                      setNewMission({ ...newMission, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="dueDate">Échéance (optionnel)</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={newMission.dueDate || ""}
                  onChange={(e) => setNewMission({ ...newMission, dueDate: e.target.value })}
                />
              </div>

              {/* Subtasks */}
              <div>
                <Label>Sous-tâches</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Ajouter une sous-tâche"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubtask())}
                  />
                  <Button type="button" variant="outline" onClick={addSubtask}>
                    <Plus className="size-4" />
                  </Button>
                </div>

                {(newMission.tasks || []).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {(newMission.tasks || []).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-lg border p-2"
                      >
                        <span className="text-sm">{task.title}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => removeSubtask(task.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
              <Button onClick={handleSaveMission} disabled={!newMission.title}>
                {editingMission ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Missions by Time Frame */}
      <Tabs value={activeTimeFrame} onValueChange={(v) => setActiveTimeFrame(v as TimeFrame)}>
        <TabsList className="grid w-full grid-cols-4">
          {TIME_FRAMES.map((tf) => (
            <TabsTrigger key={tf.value} value={tf.value} className="relative">
              {tf.label}
              {missionsByTimeFrame[tf.value].length > 0 && (
                <Badge variant="secondary" className="ml-2 size-5 p-0 justify-center">
                  {missionsByTimeFrame[tf.value].length}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TIME_FRAMES.map((tf) => (
          <TabsContent key={tf.value} value={tf.value} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* To Do Column */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Circle className="size-4 text-muted-foreground" />
                  À faire
                  <Badge variant="secondary">
                    {missionsByTimeFrame[tf.value].filter((m) => m.status === "todo").length}
                  </Badge>
                </h3>
                {missionsByTimeFrame[tf.value]
                  .filter((m) => m.status === "todo")
                  .map(renderMissionCard)}
              </div>

              {/* In Progress Column */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  En cours
                  <Badge variant="secondary">
                    {missionsByTimeFrame[tf.value].filter((m) => m.status === "in-progress").length}
                  </Badge>
                </h3>
                {missionsByTimeFrame[tf.value]
                  .filter((m) => m.status === "in-progress")
                  .map(renderMissionCard)}
              </div>

              {/* Done Column */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success" />
                  Terminé
                  <Badge variant="secondary">
                    {missionsByTimeFrame[tf.value].filter((m) => m.status === "done").length}
                  </Badge>
                </h3>
                {missionsByTimeFrame[tf.value]
                  .filter((m) => m.status === "done")
                  .map(renderMissionCard)}
              </div>
            </div>

            {missionsByTimeFrame[tf.value].length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    Aucune mission pour cette période
                  </p>
                  <Button onClick={() => {
                    setNewMission({ ...newMission, timeFrame: tf.value })
                    setIsDialogOpen(true)
                  }}>
                    <Plus className="size-4 mr-2" />
                    Créer une mission
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
