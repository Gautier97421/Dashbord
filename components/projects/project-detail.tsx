"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  ArrowLeft,
  CalendarRange,
  ChevronRight,
  Edit,
  FolderOpen,
  FolderPlus,
  FolderTree,
  History,
  Link2,
  ListChecks,
  Paperclip,
  Play,
  Star,
  StickyNote,
  Target,
  TriangleAlert,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApp } from "@/lib/store-api"
import { cn } from "@/lib/utils"
import { PRIORITY_RANK, projectTreeIds, toDay } from "@/lib/projects/core"
import type { Project, ProjectStatus } from "@/lib/types"
import { useProjectsUI } from "./context"
import { DueChip, PriorityBadge, TaskRow } from "./task-row"
import { ProjectStatusLabel, ProjectStatusPicker } from "./project-status-ui"
import { ProjectTasks } from "./project-tasks"
import { PlanningView } from "./planning-view"
import { ResourceLinks } from "./resource-links"
import { AttachmentsPanel } from "./attachments-panel"
import { ActivityPanel } from "./activity-panel"
import { ProjectDeleteButton } from "./project-delete-button"
import { ProjectFolderActions } from "./project-folder"

type DetailTab = "overview" | "tasks" | "planning" | "resources" | "activity"

interface ProjectDetailProps {
  project: Project
  // Mobile : retour à la liste
  onBack?: () => void
  onEdit: (project: Project) => void
  onCreateChild: (parentId: string) => void
  onToggleArchive: (project: Project) => void
  onDelete: (project: Project) => void
}

export function ProjectDetail({ project, onBack, onEdit, onCreateChild, onToggleArchive, onDelete }: ProjectDetailProps) {
  const { state, updateProject } = useApp()
  const { projectById, projectStats, alertsByProject, tasks, today, setSelectedProjectId } = useProjectsUI()
  const [tab, setTab] = useState<DetailTab>("overview")

  const treeIds = useMemo(() => projectTreeIds(state.projects, project.id), [state.projects, project.id])
  const children = state.projects.filter((p) => p.parentId === project.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const ancestors = useMemo(() => {
    const list: Project[] = []
    let cur = project.parentId ? projectById.get(project.parentId) : undefined
    while (cur && !list.includes(cur)) {
      list.unshift(cur)
      cur = cur.parentId ? projectById.get(cur.parentId) : undefined
    }
    return list
  }, [project.parentId, projectById])

  const stats = projectStats.get(project.id)
  const alerts = alertsByProject.get(project.id) || []
  const openTreeTasks = tasks.filter((t) => t.projectId && treeIds.has(t.projectId) && t.status !== "done")
  const blockedCount = openTreeTasks.filter((t) => t.dependsOn?.some((id) => tasks.find((d) => d.id === id && d.status !== "done"))).length

  // Prochaines étapes : tâches ouvertes les plus pressantes du projet et de ses sous-projets
  const nextSteps = [...openTreeTasks]
    .sort((a, b) => (toDay(a.dueDate) || "9999").localeCompare(toDay(b.dueDate) || "9999") || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
    .slice(0, 5)

  const setStatus = (status: ProjectStatus | null) => updateProject({ ...project, status })
  const start = toDay(project.startDate)
  const deadline = toDay(project.deadline)

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-3 border-b p-4">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          {onBack && (
            <Button variant="ghost" size="sm" className="-ml-2 h-7 px-2" onClick={onBack}>
              <ArrowLeft className="size-4" />
              Projets
            </Button>
          )}
          {ancestors.length > 0 && (
            <nav aria-label="Projets parents" className="flex min-w-0 flex-wrap items-center gap-1">
              {ancestors.map((a) => (
                <span key={a.id} className="flex items-center gap-1">
                  <button type="button" className="truncate hover:text-foreground hover:underline" onClick={() => setSelectedProjectId(a.id)}>
                    {a.title}
                  </button>
                  <ChevronRight className="size-3.5" />
                </span>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className={cn("text-lg font-semibold leading-tight sm:text-xl", project.completedAt && "line-through opacity-70")}>{project.title}</h2>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => updateProject({ ...project, favorite: !project.favorite })}
                aria-label={project.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                title={project.favorite ? "Retirer des favoris" : "Épingler en favori"}
              >
                <Star className={cn("size-4", project.favorite ? "fill-warning text-warning" : "text-muted-foreground")} />
              </Button>
            </div>
            {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
          </div>
          <ProjectFolderActions project={project} />
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => onEdit(project)}>
            <Edit className="size-4" />
            <span className="hidden sm:inline">Modifier</span>
          </Button>
          <ProjectDeleteButton project={project} descendants={treeIds.size - 1} onDelete={() => onDelete(project)} size="md" />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {project.completedAt && <Badge variant="secondary">Archivé</Badge>}
          <ProjectStatusPicker status={project.status} onChange={setStatus} />
          <PriorityBadge priority={project.priority} always />
          {project.category && <Badge variant="outline">{project.category}</Badge>}
          {start && (
            <span className="inline-flex items-center gap-1 text-muted-foreground" title="Début">
              <Play className="size-3" />
              {new Date(`${start}T00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </span>
          )}
          {deadline && <DueChip day={deadline} today={today} done={!!project.completedAt || project.status === "done"} />}
        </div>

        {stats?.progress != null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {stats.done}/{stats.total} tâches{children.length > 0 && " (sous-projets inclus)"}
              </span>
              <span className="font-medium text-foreground">{stats.progress}%</span>
            </div>
            <Progress value={stats.progress} className="h-2" />
          </div>
        )}

        {alerts.length > 0 && (
          <div className="space-y-1">
            {alerts.map((a) => (
              <p
                key={a.dedupeKey}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                  a.severity === "high" ? "bg-destructive/10 text-destructive" : a.severity === "medium" ? "bg-warning/15 text-warning-foreground dark:text-warning" : "bg-muted text-muted-foreground"
                )}
              >
                <TriangleAlert className="size-3.5 shrink-0" />
                {a.body}
              </p>
            ))}
          </div>
        )}
      </CardHeader>

      <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)} className="gap-0">
        <div className="overflow-x-auto border-b px-2 py-2">
          <TabsList className="w-max">
            <TabsTrigger value="overview">
              <FolderOpen />
              Aperçu
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <ListChecks />
              Tâches
              {openTreeTasks.length > 0 && <span className="text-xs text-muted-foreground">{openTreeTasks.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="planning">
              <CalendarRange />
              Planning
            </TabsTrigger>
            <TabsTrigger value="resources">
              <Link2 />
              Ressources
            </TabsTrigger>
            <TabsTrigger value="activity">
              <History />
              Activité
            </TabsTrigger>
          </TabsList>
        </div>

        <CardContent className="p-4">
          <TabsContent value="overview" className="space-y-6">
            {nextSteps.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <ListChecks className="size-4 text-muted-foreground" />
                  Prochaines étapes
                  {blockedCount > 0 && <span className="text-xs font-normal text-destructive">· {blockedCount} bloquée{blockedCount > 1 ? "s" : ""}</span>}
                </h3>
                <div className="space-y-1">
                  {nextSteps.map((t) => (
                    <TaskRow key={t.id} task={t} compact showProject={t.projectId !== project.id} />
                  ))}
                </div>
                {openTreeTasks.length > nextSteps.length && (
                  <Button variant="ghost" size="sm" onClick={() => setTab("tasks")}>
                    Voir les {openTreeTasks.length} tâches
                  </Button>
                )}
              </section>
            )}

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <FolderTree className="size-4 text-muted-foreground" />
                  Sous-projets ({children.length})
                </h3>
                <Button variant="outline" size="sm" onClick={() => onCreateChild(project.id)}>
                  <FolderPlus className="size-4" />
                  Sous-projet
                </Button>
              </div>
              {children.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {children.map((child) => {
                    const childStats = projectStats.get(child.id)
                    const grandChildren = state.projects.filter((p) => p.parentId === child.id).length
                    const childDeadline = toDay(child.deadline)
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => setSelectedProjectId(child.id)}
                        className={cn("space-y-1.5 rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/50", child.completedAt && "opacity-60")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("truncate text-sm font-medium", child.completedAt && "line-through")}>{child.title}</span>
                          {childStats?.progress != null && <span className="shrink-0 text-xs text-muted-foreground">{childStats.progress}%</span>}
                        </div>
                        {childStats?.progress != null && <Progress value={childStats.progress} className="h-1.5" />}
                        {(child.status || grandChildren > 0 || childDeadline) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <ProjectStatusLabel status={child.status} />
                            {childDeadline && <DueChip day={childDeadline} today={today} done={!!child.completedAt || child.status === "done"} />}
                            {grandChildren > 0 && <span>{grandChildren} sous-projet{grandChildren > 1 ? "s" : ""}</span>}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun sous-projet. Utile pour découper le projet en étapes ou ranger plusieurs projets dans un même dossier.</p>
              )}
            </section>

            {project.objectives.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Target className="size-4 text-muted-foreground" />
                  Objectifs
                </h3>
                <ul className="space-y-1.5">
                  {project.objectives.map((obj, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
                      <span className="size-2 shrink-0 rounded-full bg-primary" />
                      {obj}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <StickyNote className="size-4 text-muted-foreground" />
                  Notes
                </h3>
                <Button variant="ghost" size="sm" onClick={() => onEdit(project)}>
                  {project.notes ? "Modifier" : "Ajouter"}
                </Button>
              </div>
              {project.notes ? (
                <p className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm">{project.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune note.</p>
              )}
            </section>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => onToggleArchive(project)}>
                {project.completedAt ? <FolderOpen className="size-4" /> : <Archive className="size-4" />}
                {project.completedAt ? "Réactiver" : "Archiver"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            <ProjectTasks project={project} treeIds={treeIds} hasChildren={children.length > 0} />
          </TabsContent>

          <TabsContent value="planning">
            <PlanningView projectIds={treeIds} />
          </TabsContent>

          <TabsContent value="resources" className="space-y-6">
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Link2 className="size-4 text-muted-foreground" />
                Liens
              </h3>
              <p className="text-xs text-muted-foreground">Dossier du projet (C:\…), app en ligne, documentation, dépôt…</p>
              <ResourceLinks links={project.links || []} onChange={(links) => updateProject({ ...project, links })} />
            </section>
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Paperclip className="size-4 text-muted-foreground" />
                Fichiers et documents
              </h3>
              <AttachmentsPanel projectId={project.id} />
            </section>
          </TabsContent>

          <TabsContent value="activity">
            <ActivityPanel projectIds={[...treeIds]} showTask version={project.updatedAt} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
