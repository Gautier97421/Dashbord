"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarClock, CheckCircle2, CircleAlert, FolderOpen, History, ListTodo, OctagonPause, Star, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useApp } from "@/lib/store-api"
import { cn } from "@/lib/utils"
import { addDays, daysBetween, endOfWeek, relativeDay, toDay, type ProjectAlert } from "@/lib/projects/core"
import { getProjectStatus } from "@/lib/project-status"
import type { Project, Task } from "@/lib/types"
import { projectPath, useProjectsUI } from "./context"
import { TaskRow } from "./task-row"
import { timeAgo, type ActivityItem } from "./activity-panel"

const SEVERITY_STYLE: Record<ProjectAlert["severity"], string> = {
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
}

const UPCOMING_DAYS = 14
const LIST_LIMIT = 8

function Stat({ icon: Icon, label, value, hint, tone, onClick }: { icon: typeof FolderOpen; label: string; value: number; hint?: string; tone?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40 sm:p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
        <Icon className={cn("size-4", tone)} />
        {label}
      </div>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone)}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </button>
  )
}

export function OverviewView() {
  const { state } = useApp()
  const { tasks, today, alerts, projectStats, projectById, openProject, openTask, setView } = useProjectsUI()
  const [taskRange, setTaskRange] = useState<"today" | "week">("today")
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[] | null>(null)

  const projects = state.projects
  const active = projects.filter((p) => !p.completedAt && p.status !== "done")
  const finished = projects.filter((p) => p.completedAt || p.status === "done")
  const overdueProjects = alerts.filter((a) => a.kind === "project_overdue")
  const openTasks = tasks.filter((t) => t.status !== "done")
  const overdueTasks = openTasks.filter((t) => toDay(t.dueDate) && toDay(t.dueDate)! < today)
  const weekEnd = endOfWeek(today)

  const rangeTasks = useMemo(() => {
    const limit = taskRange === "today" ? today : weekEnd
    return openTasks
      .filter((t) => toDay(t.dueDate) && toDay(t.dueDate)! <= limit)
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
  }, [openTasks, taskRange, today, weekEnd])

  // Projets dont la progression est bloquée : à l'arrêt, à démarrer, ou avec des tâches bloquées
  const stuck = useMemo(() => {
    const reasons = new Map<string, string[]>()
    const add = (id: string | undefined, reason: string) => id && reasons.set(id, [...(reasons.get(id) || []), reason])
    for (const a of alerts) {
      if (a.kind === "project_stale" || a.kind === "project_should_start") add(a.projectId, a.body)
      if (a.kind === "task_blocked" && a.projectId) add(a.projectId, `Tâche bloquée : ${a.title.replace(/^Bloquée : /, "")}`)
    }
    return [...reasons.entries()]
      .map(([id, list]) => ({ project: projectById.get(id), reasons: [...new Set(list)] }))
      .filter((x): x is { project: Project; reasons: string[] } => !!x.project && !x.project.completedAt)
  }, [alerts, projectById])

  const upcoming = useMemo(() => {
    const limit = addDays(today, UPCOMING_DAYS)
    const items: { day: string; kind: "project" | "task"; id: string; title: string; sub: string | null }[] = []
    for (const p of active) {
      const d = toDay(p.deadline)
      if (d && d >= today && d <= limit) items.push({ day: d, kind: "project", id: p.id, title: p.title, sub: p.parentId ? projectPath(p.parentId, projectById) : null })
    }
    for (const t of openTasks) {
      const d = toDay(t.dueDate)
      if (d && d >= today && d <= limit && (t.priority === "high" || t.priority === "urgent" || d > addDays(today, 1))) {
        items.push({ day: d, kind: "task", id: t.id, title: t.title, sub: projectPath(t.projectId, projectById) })
      }
    }
    return items.sort((a, b) => a.day.localeCompare(b.day)).slice(0, 10)
  }, [active, openTasks, today, projectById])

  const favorites = projects.filter((p) => p.favorite && !p.completedAt)

  // Dernière modification connue : recharge l'activité récente quand quelque chose change
  const lastChange = useMemo(
    () => [...projects.map((p) => p.updatedAt || ""), ...tasks.map((t) => t.updatedAt || "")].sort().at(-1) || "",
    [projects, tasks]
  )
  useEffect(() => {
    fetch("/api/project-activity?recent=1&limit=15")
      .then((r) => (r.ok ? r.json() : null))
      .then((items) => items && setActivity(items))
      .catch(() => {})
  }, [lastChange])

  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 5)
  const openAlert = (a: ProjectAlert) => (a.taskId ? openTask(a.taskId) : a.projectId && openProject(a.projectId))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 @4xl/main:grid-cols-4">
        <Stat icon={FolderOpen} label="Projets actifs" value={active.length} hint={`${active.filter((p) => !p.parentId).length} principaux`} onClick={() => setView("projects")} />
        <Stat icon={CheckCircle2} label="Terminés" value={finished.length} tone="text-success" onClick={() => setView("projects")} />
        <Stat
          icon={TriangleAlert}
          label="Projets en retard"
          value={overdueProjects.length}
          tone={overdueProjects.length ? "text-destructive" : undefined}
          onClick={() => overdueProjects[0]?.projectId && openProject(overdueProjects[0].projectId)}
        />
        <Stat
          icon={ListTodo}
          label="Tâches en retard"
          value={overdueTasks.length}
          hint={`${openTasks.filter((t) => toDay(t.dueDate) && toDay(t.dueDate)! >= today && toDay(t.dueDate)! <= weekEnd).length} cette semaine`}
          tone={overdueTasks.length ? "text-destructive" : undefined}
          onClick={() => setView("tasks")}
        />
      </div>

      {favorites.length > 0 && (
        <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {favorites.map((p) => {
            const stats = projectStats.get(p.id)
            return (
              <button key={p.id} type="button" onClick={() => openProject(p.id)} className="flex shrink-0 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-muted/50">
                <Star className="size-3.5 fill-warning text-warning" />
                <span className="max-w-40 truncate font-medium">{p.title}</span>
                {stats?.progress != null && <span className="text-xs text-muted-foreground tabular-nums">{stats.progress}%</span>}
              </button>
            )
          })}
        </div>
      )}

      {alerts.length > 0 && (
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleAlert className="size-4 text-destructive" />
              Alertes
              <span className="text-sm font-normal text-muted-foreground">{alerts.length}</span>
            </CardTitle>
            {alerts.length > 5 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllAlerts((v) => !v)}>
                {showAllAlerts ? "Réduire" : "Tout voir"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <ul>
              {visibleAlerts.map((a) => (
                <li key={a.dedupeKey}>
                  <button type="button" onClick={() => openAlert(a)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/50">
                    <TriangleAlert className={cn("mt-0.5 size-4 shrink-0", SEVERITY_STYLE[a.severity])} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.body}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 @4xl/main:grid-cols-3">
        <Card className="gap-0 py-0 @4xl/main:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="size-4 text-primary" />
              À faire
            </CardTitle>
            <ToggleGroup type="single" size="sm" variant="outline" value={taskRange} onValueChange={(v) => v && setTaskRange(v as "today" | "week")}>
              <ToggleGroupItem value="today">Aujourd&apos;hui</ToggleGroupItem>
              <ToggleGroupItem value="week">Cette semaine</ToggleGroupItem>
            </ToggleGroup>
          </CardHeader>
          <CardContent className="space-y-1 px-3 pb-3">
            {rangeTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{taskRange === "today" ? "Rien d'urgent aujourd'hui" : "Rien de prévu cette semaine"}</p>
            ) : (
              rangeTasks.slice(0, LIST_LIMIT).map((t: Task) => <TaskRow key={t.id} task={t} compact />)
            )}
            {rangeTasks.length > LIST_LIMIT && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setView("tasks")}>
                Voir les {rangeTasks.length} tâches
                <ArrowRight className="size-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-primary" />
              Échéances proches
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune échéance dans les {UPCOMING_DAYS} jours</p>
            ) : (
              <ul>
                {upcoming.map((item) => (
                  <li key={`${item.kind}:${item.id}`}>
                    <button
                      type="button"
                      onClick={() => (item.kind === "task" ? openTask(item.id) : openProject(item.id))}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/50"
                    >
                      <span className={cn("w-16 shrink-0 text-xs font-medium", daysBetween(today, item.day) <= 1 ? "text-warning" : "text-muted-foreground")}>
                        {relativeDay(item.day, today)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate text-sm">
                          {item.kind === "project" && <FolderOpen className="size-3.5 shrink-0 text-primary" />}
                          <span className="truncate">{item.title}</span>
                        </span>
                        {item.sub && <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0 @4xl/main:col-span-2">
          <CardHeader className="px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <OctagonPause className="size-4 text-warning" />
              Projets à débloquer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3">
            {stuck.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Tous les projets avancent</p>
            ) : (
              stuck.slice(0, 6).map(({ project, reasons }) => {
                const stats = projectStats.get(project.id)
                const status = getProjectStatus(project.status)
                return (
                  <button key={project.id} type="button" onClick={() => openProject(project.id)} className="block w-full rounded-lg border p-2.5 text-left hover:bg-muted/40">
                    <div className="flex items-center gap-2">
                      {status && <status.icon className={cn("size-4 shrink-0", status.className)} />}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.title}</span>
                      {stats?.progress != null && <span className="text-xs text-muted-foreground tabular-nums">{stats.progress}%</span>}
                    </div>
                    {stats?.progress != null && <Progress value={stats.progress} className="mt-1.5 h-1" />}
                    <ul className="mt-1.5 space-y-0.5">
                      {reasons.slice(0, 3).map((r) => (
                        <li key={r} className="truncate text-xs text-muted-foreground">
                          · {r}
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-muted-foreground" />
              Dernières modifications
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {activity === null ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
            ) : activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune modification pour l&apos;instant</p>
            ) : (
              <ul>
                {activity.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      disabled={!a.taskId && !a.projectId}
                      onClick={() => (a.taskId ? openTask(a.taskId) : a.projectId && openProject(a.projectId))}
                      className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted/50 disabled:hover:bg-transparent"
                    >
                      <span className="line-clamp-2 text-sm">{a.kind === "comment" ? `💬 ${a.message}` : a.message}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {timeAgo(a.createdAt)}
                        {a.projectTitle && ` · ${a.projectTitle}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
