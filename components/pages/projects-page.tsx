"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  Trash2,
  Edit,
  Calendar,
  Target,
  CheckCircle2,
  FolderOpen,
  Archive,
} from "lucide-react"
import { useApp } from "@/lib/store-api"
import { generateId, formatDateFr } from "@/lib/helpers"
import type { Project, Task, TaskStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ProjectsPage() {
  const { state, addProject, updateProject, deleteProject, addTask: addTaskApi, updateTask, deleteTask } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [newProject, setNewProject] = useState<Partial<Project>>({
    title: "",
    description: "",
    objectives: [],
    tasks: [],
  })
  const [newObjective, setNewObjective] = useState("")
  const [newTask, setNewTask] = useState("")
  const [showCompleted, setShowCompleted] = useState(false)

  const activeProjects = useMemo(() => {
    return state.projects.filter((p) => !p.completedAt)
  }, [state.projects])

  const completedProjects = useMemo(() => {
    return state.projects.filter((p) => p.completedAt)
  }, [state.projects])

  // Helper: Get tasks for a specific project from global state
  const getProjectTasks = useCallback((projectId: string) => {
    return state.tasks.filter((t) => t.projectId === projectId)
  }, [state.tasks])

  const selectedProject = useMemo(() => {
    const project = state.projects.find((p) => p.id === selectedProjectId)
    if (!project) return undefined
    // Add tasks from state
    return { ...project, tasks: getProjectTasks(project.id) }
  }, [state.projects, getProjectTasks, selectedProjectId])

  const getProjectProgress = (projectId: string) => {
    const tasks = getProjectTasks(projectId)
    if (tasks.length === 0) return 0
    const completed = tasks.filter((t) => t.status === "done").length
    return Math.round((completed / tasks.length) * 100)
  }

  const handleSaveProject = async () => {
    if (!newProject.title) return

    if (editingProject) {
      await updateProject({
        ...editingProject,
        title: newProject.title!,
        description: newProject.description,
        objectives: newProject.objectives || [],
        deadline: newProject.deadline,
      })
    } else {
      await addProject({
        title: newProject.title!,
        description: newProject.description,
        objectives: newProject.objectives || [],
        tasks: [],
        deadline: newProject.deadline,
      })
    }

    resetForm()
  }

  const resetForm = () => {
    setNewProject({
      title: "",
      description: "",
      objectives: [],
      tasks: [],
    })
    setEditingProject(null)
    setIsDialogOpen(false)
    setNewObjective("")
    setNewTask("")
  }

  const openEditDialog = (project: Project) => {
    setEditingProject(project)
    setNewProject({
      title: project.title,
      description: project.description,
      objectives: project.objectives,
      tasks: project.tasks,
      deadline: project.deadline,
    })
    setIsDialogOpen(true)
  }

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id)
    if (selectedProjectId === id) {
      setSelectedProjectId(null)
    }
  }

  const toggleProjectComplete = async (project: Project) => {
    await updateProject({
      ...project,
      completedAt: project.completedAt ? undefined : new Date().toISOString(),
    })
  }

  const addObjective = () => {
    if (!newObjective.trim()) return
    setNewProject({
      ...newProject,
      objectives: [...(newProject.objectives || []), newObjective],
    })
    setNewObjective("")
  }

  const removeObjective = (index: number) => {
    setNewProject({
      ...newProject,
      objectives: (newProject.objectives || []).filter((_, i) => i !== index),
    })
  }

  const addTask = () => {
    if (!newTask.trim()) return
    const task: Task = {
      id: generateId(),
      title: newTask,
      priority: "medium",
      status: "todo",
      createdAt: new Date().toISOString(),
    }
    setNewProject({
      ...newProject,
      tasks: [...(newProject.tasks || []), task],
    })
    setNewTask("")
  }

  const removeTask = (taskId: string) => {
    setNewProject({
      ...newProject,
      tasks: (newProject.tasks || []).filter((t) => t.id !== taskId),
    })
  }

  const toggleTaskInProject = async (projectId: string, taskId: string) => {
    const task = state.tasks.find((t) => t.id === taskId)
    if (!task) return

    const newStatus = task.status === "done" ? "todo" : "done"
    
    await updateTask({
      ...task,
      status: newStatus,
      completedAt: newStatus === "done" ? new Date().toISOString() : undefined,
    })
  }

  const addTaskToProject = async (projectId: string, title: string) => {
    if (!title.trim()) return

    await addTaskApi({
      title,
      priority: "medium",
      status: "todo",
      projectId,
    })
  }

  const deleteTaskFromProject = async (projectId: string, taskId: string) => {
    await deleteTask(taskId)
  }

  const renderProjectCard = (project: Project) => {
    const progress = getProjectProgress(project.id)
    const projectTasks = getProjectTasks(project.id)
    const isSelected = selectedProjectId === project.id

    return (
      <Card
        key={project.id}
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          isSelected && "ring-2 ring-primary",
          project.completedAt && "opacity-60"
        )}
        onClick={() => setSelectedProjectId(project.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "font-semibold truncate",
                project.completedAt && "line-through"
              )}>
                {project.title}
              </h3>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {project.description}
                </p>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  openEditDialog(project)
                }}>
                  <Edit className="size-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  toggleProjectComplete(project)
                }}>
                  {project.completedAt ? (
                    <>
                      <FolderOpen className="size-4 mr-2" />
                      Réactiver
                    </>
                  ) : (
                    <>
                      <Archive className="size-4 mr-2" />
                      Archiver
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteProject(project.id)
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="size-4" />
              <span>{projectTasks.filter((t) => t.status === "done").length}/{projectTasks.length}</span>
            </div>
            {project.deadline && (
              <div className="flex items-center gap-1">
                <Calendar className="size-4" />
                <span>{formatDateFr(project.deadline, "short")}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Projets</h1>
          <p className="text-sm text-muted-foreground">Gérez vos projets et leurs tâches</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm()
          setIsDialogOpen(open)
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="sm:size-default w-full sm:w-auto">
              <Plus className="size-4 mr-2" />
              Nouveau projet
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProject ? "Modifier le projet" : "Nouveau projet"}</DialogTitle>
              <DialogDescription>
                {editingProject
                  ? "Modifiez les détails de ce projet"
                  : "Créez un nouveau projet avec des objectifs clairs"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Nom du projet</Label>
                <Input
                  id="title"
                  placeholder="Ex: Refonte du site web"
                  value={newProject.title}
                  onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez votre projet..."
                  value={newProject.description || ""}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="deadline">Échéance</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={newProject.deadline || ""}
                  onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                />
              </div>

              {/* Objectives */}
              <div>
                <Label>Objectifs</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Ajouter un objectif"
                    value={newObjective}
                    onChange={(e) => setNewObjective(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addObjective())}
                  />
                  <Button type="button" variant="outline" onClick={addObjective}>
                    <Plus className="size-4" />
                  </Button>
                </div>

                {(newProject.objectives || []).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {(newProject.objectives || []).map((obj, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg border p-2"
                      >
                        <div className="flex items-center gap-2">
                          <Target className="size-4 text-primary" />
                          <span className="text-sm">{obj}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => removeObjective(index)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div>
                <Label>Tâches</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Ajouter une tâche"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTask())}
                  />
                  <Button type="button" variant="outline" onClick={addTask}>
                    <Plus className="size-4" />
                  </Button>
                </div>

                {(newProject.tasks || []).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {(newProject.tasks || []).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-lg border p-2"
                      >
                        <span className="text-sm">{task.title}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => removeTask(task.id)}
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
              <Button onClick={handleSaveProject} disabled={!newProject.title}>
                {editingProject ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Projects List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Projets actifs</h2>
            <Badge variant="secondary">{activeProjects.length}</Badge>
          </div>

          <div className="space-y-3">
            {activeProjects.map(renderProjectCard)}
          </div>

          {activeProjects.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <FolderOpen className="size-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Aucun projet actif</p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="size-4 mr-2" />
                  Créer un projet
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Completed Projects */}
          {completedProjects.length > 0 && (
            <>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                <Archive className="size-4 mr-2" />
                Projets archivés ({completedProjects.length})
              </Button>

              {showCompleted && (
                <div className="space-y-3">
                  {completedProjects.map(renderProjectCard)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Project Detail */}
        <div className="lg:col-span-2">
          {selectedProject ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedProject.title}</CardTitle>
                    {selectedProject.description && (
                      <CardDescription className="mt-1">
                        {selectedProject.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant={selectedProject.completedAt ? "secondary" : "default"}>
                    {selectedProject.completedAt ? "Archivé" : "Actif"}
                  </Badge>
                </div>

                {selectedProject.deadline && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <Calendar className="size-4" />
                    <span>Échéance : {formatDateFr(selectedProject.deadline, "long")}</span>
                  </div>
                )}

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Progression globale</span>
                    <span className="font-medium">{getProjectProgress(selectedProject.id)}%</span>
                  </div>
                  <Progress value={getProjectProgress(selectedProject.id)} className="h-3" />
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Objectives */}
                {selectedProject.objectives.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Target className="size-4" />
                      Objectifs
                    </h3>
                    <div className="space-y-2">
                      {selectedProject.objectives.map((obj, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/50"
                        >
                          <div className="size-2 rounded-full bg-primary" />
                          {obj}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tasks */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle2 className="size-4" />
                    Tâches ({selectedProject.tasks.filter((t) => t.status === "done").length}/{selectedProject.tasks.length})
                  </h3>

                  {/* Add task input */}
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="Ajouter une tâche..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value) {
                          addTaskToProject(selectedProject.id, e.currentTarget.value)
                          e.currentTarget.value = ""
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        const input = e.currentTarget.previousSibling as HTMLInputElement
                        if (input.value) {
                          addTaskToProject(selectedProject.id, input.value)
                          input.value = ""
                        }
                      }}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {selectedProject.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3 transition-colors",
                          task.status === "done" && "bg-success/5 border-success/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={task.status === "done"}
                            onCheckedChange={() => toggleTaskInProject(selectedProject.id, task.id)}
                          />
                          <span className={cn(
                            "text-sm",
                            task.status === "done" && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          onClick={() => deleteTaskFromProject(selectedProject.id, task.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}

                    {selectedProject.tasks.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        Aucune tâche pour ce projet
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="size-16 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Sélectionnez un projet</h3>
                <p className="text-muted-foreground">
                  Cliquez sur un projet pour voir ses détails
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
