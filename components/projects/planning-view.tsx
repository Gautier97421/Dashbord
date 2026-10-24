"use client"

import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Flag, GanttChart, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useApp } from "@/lib/store-api"
import { cn } from "@/lib/utils"
import { DayNumber, MonthNav } from "@/components/month-calendar"
import { addDays, addMonths, daysBetween, formatDay, startOfWeek, toDay } from "@/lib/projects/core"
import { getProjectStatus } from "@/lib/project-status"
import type { Project, Task } from "@/lib/types"
import { buildProjectOptions, projectPath, useProjectsUI } from "./context"
import { TaskRow } from "./task-row"

type PlanItem =
  | { kind: "task"; day: string; task: Task }
  | { kind: "deadline"; day: string; project: Project }
  | { kind: "start"; day: string; project: Project }
  | { kind: "event"; day: string; id: string; title: string; time?: string; projectId?: string }

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

const monthLabel = (first: string) => {
  const [y, m] = first.split("-").map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Calendrier des échéances, jalons et événements ; `projectIds` limite à un projet et ses sous-projets. */
export function PlanningView({ projectIds }: { projectIds?: Set<string> }) {
  const { state } = useApp()
  const { tasks, today } = useProjectsUI()
  const [mode, setMode] = useState<"month" | "timeline">("month")
  const [month, setMonth] = useState(() => `${today.slice(0, 7)}-01`)
  const [selected, setSelected] = useState(today)

  const inScope = (projectId?: string | null) => !projectIds || (!!projectId && projectIds.has(projectId))
  const projects = useMemo(() => state.projects.filter((p) => !projectIds || projectIds.has(p.id)), [state.projects, projectIds])

  const itemsByDay = useMemo(() => {
    const inScope = (projectId?: string | null) => !projectIds || (!!projectId && projectIds.has(projectId))
    const map = new Map<string, PlanItem[]>()
    const push = (item: PlanItem) => map.set(item.day, [...(map.get(item.day) || []), item])
    for (const t of tasks) {
      const due = toDay(t.dueDate)
      if (due && inScope(t.projectId)) push({ kind: "task", day: due, task: t })
    }
    for (const p of projects) {
      const deadline = toDay(p.deadline)
      if (deadline) push({ kind: "deadline", day: deadline, project: p })
      const start = toDay(p.startDate)
      if (start) push({ kind: "start", day: start, project: p })
    }
    for (const e of state.calendarEvents) {
      if (e.projectId && inScope(e.projectId)) push({ kind: "event", day: e.date.slice(0, 10), id: e.id, title: e.title, time: e.startTime, projectId: e.projectId })
    }
    return map
  }, [tasks, projects, state.calendarEvents, projectIds])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => v && setMode(v as "month" | "timeline")}>
          <ToggleGroupItem value="month">
            <CalendarDays className="size-4" />
            Mois
          </ToggleGroupItem>
          <ToggleGroupItem value="timeline">
            <GanttChart className="size-4" />
            Chronologie
          </ToggleGroupItem>
        </ToggleGroup>
        {mode === "month" && (
          <MonthNav
            className="ml-auto"
            label={monthLabel(month)}
            onPrev={() => setMonth(addMonths(month, -1))}
            onNext={() => setMonth(addMonths(month, 1))}
            onToday={() => {
              setMonth(`${today.slice(0, 7)}-01`)
              setSelected(today)
            }}
          />
        )}
      </div>

      {mode === "month" ? (
        <MonthGrid month={month} today={today} selected={selected} onSelect={setSelected} itemsByDay={itemsByDay} />
      ) : (
        <Timeline projects={projects} tasks={tasks.filter((t) => inScope(t.projectId))} today={today} />
      )}
    </div>
  )
}

function itemTone(item: PlanItem, today: string) {
  if (item.kind === "deadline") return item.project.completedAt || item.project.status === "done" ? "text-success" : item.day < today ? "text-destructive" : "text-primary"
  if (item.kind === "start") return "text-muted-foreground"
  if (item.kind === "event") return "text-sky-600 dark:text-sky-400"
  if (item.task.status === "done") return "text-muted-foreground line-through"
  return item.day < today ? "text-destructive" : item.task.priority === "urgent" || item.task.priority === "high" ? "text-warning" : "text-foreground"
}

function itemLabel(item: PlanItem) {
  if (item.kind === "task") return item.task.title
  if (item.kind === "event") return item.title
  return item.project.title
}

function ItemIcon({ item, className }: { item: PlanItem; className?: string }) {
  if (item.kind === "deadline") return <Flag className={cn("size-3 shrink-0", className)} />
  if (item.kind === "start") return <Play className={cn("size-3 shrink-0", className)} />
  if (item.kind === "event") return <Clock className={cn("size-3 shrink-0", className)} />
  return <span className={cn("size-1.5 shrink-0 rounded-full bg-current", className)} />
}

function MonthGrid({
  month,
  today,
  selected,
  onSelect,
  itemsByDay,
}: {
  month: string
  today: string
  selected: string
  onSelect: (day: string) => void
  itemsByDay: Map<string, PlanItem[]>
}) {
  const { openProject, openTask, projectById } = useProjectsUI()
  const first = startOfWeek(month)
  const nextMonth = addMonths(month, 1)
  const weeks = Math.ceil(daysBetween(first, nextMonth) / 7)
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i))
  const selectedItems = itemsByDay.get(selected) || []

  const open = (item: PlanItem) => {
    if (item.kind === "task") openTask(item.task.id)
    else if (item.kind === "event") item.projectId && openProject(item.projectId)
    else openProject(item.project.id)
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1.5 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const items = itemsByDay.get(day) || []
            const outside = day < month || day >= nextMonth
            const isToday = day === today
            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelect(day)}
                className={cn(
                  "@container flex min-h-14 min-w-0 flex-col items-stretch gap-0.5 border-b border-r p-1 text-left transition-colors hover:bg-muted/40 sm:min-h-24 [&:nth-child(7n)]:border-r-0",
                  outside && "bg-muted/20 text-muted-foreground",
                  isToday && "bg-primary/5",
                  selected === day && "bg-primary/5 ring-1 ring-inset ring-primary"
                )}
                aria-label={`${formatDay(day, true)} : ${items.length} élément${items.length > 1 ? "s" : ""}`}
              >
                <DayNumber day={Number(day.slice(8))} isToday={isToday} />
                {/* Mobile : des points ; plus grand : les titres */}
                <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                  {items.slice(0, 4).map((item, i) => (
                    <span key={i} className={cn("size-1.5 rounded-full bg-current", itemTone(item, today))} />
                  ))}
                </span>
                <span className="hidden space-y-0.5 sm:block">
                  {items.slice(0, 3).map((item, i) => (
                    <span key={i} className={cn("flex items-center gap-1 truncate text-[11px] leading-tight", itemTone(item, today))}>
                      <ItemIcon item={item} />
                      <span className="truncate">{itemLabel(item)}</span>
                    </span>
                  ))}
                  {items.length > 3 && <span className="block text-[11px] text-muted-foreground">+{items.length - 3}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold">{formatDay(selected, true)}</h3>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rien de prévu ce jour-là.</p>
        ) : (
          selectedItems.map((item, i) =>
            item.kind === "task" ? (
              <TaskRow key={`t${item.task.id}`} task={item.task} compact />
            ) : (
              <button key={i} type="button" onClick={() => open(item)} className="flex w-full items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-left hover:bg-muted/40">
                <ItemIcon item={item} className={cn("size-4", itemTone(item, selected))} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{itemLabel(item)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.kind === "deadline" ? "Échéance du projet (jalon)" : item.kind === "start" ? "Début du projet" : `Événement${item.time ? ` à ${item.time}` : ""}`}
                    {item.kind !== "event" && item.project.parentId && ` · ${projectPath(item.project.parentId, projectById)}`}
                  </span>
                </span>
              </button>
            )
          )
        )}
      </div>
    </div>
  )
}

const TIMELINE_WEEKS = 12

function Timeline({ projects, tasks, today }: { projects: Project[]; tasks: Task[]; today: string }) {
  const { openProject } = useProjectsUI()
  const [start, setStart] = useState(() => addDays(startOfWeek(today), -14))
  const days = TIMELINE_WEEKS * 7
  const end = addDays(start, days)
  const pct = (day: string) => (Math.min(Math.max(daysBetween(start, day), 0), days) / days) * 100

  // Projets datés, dans l'ordre de l'arborescence
  const rows = buildProjectOptions(projects).filter(({ project }) => toDay(project.startDate) || toDay(project.deadline))
  const tasksByProject = new Map<string, Task[]>()
  for (const t of tasks) if (t.projectId && toDay(t.dueDate)) tasksByProject.set(t.projectId, [...(tasksByProject.get(t.projectId) || []), t])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="size-8" onClick={() => setStart(addDays(start, -28))} aria-label="Période précédente">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">
          {formatDay(start)} – {formatDay(addDays(end, -1), true)}
        </span>
        <Button variant="outline" size="icon" className="size-8" onClick={() => setStart(addDays(start, 28))} aria-label="Période suivante">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          Ajoute une date de début ou une échéance à tes projets pour les voir sur la chronologie.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <div className="min-w-[640px]">
            <div className="relative ml-40 h-6 border-b text-[10px] text-muted-foreground sm:ml-52">
              {Array.from({ length: TIMELINE_WEEKS }, (_, w) => (
                <span key={w} className="absolute top-1 border-l pl-1" style={{ left: `${(w / TIMELINE_WEEKS) * 100}%` }}>
                  {formatDay(addDays(start, w * 7))}
                </span>
              ))}
            </div>
            {rows.map(({ project, depth }) => {
              const s = toDay(project.startDate) || toDay(project.createdAt)!
              const e = toDay(project.deadline) || addDays(s, 7)
              const visible = e >= start && s < end
              const status = getProjectStatus(project.status)
              const late = !!toDay(project.deadline) && toDay(project.deadline)! < today && !project.completedAt && project.status !== "done"
              return (
                <div key={project.id} className="flex items-center border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => openProject(project.id)}
                    className="flex w-40 shrink-0 items-center gap-1.5 truncate px-2 py-1.5 text-left text-xs hover:underline sm:w-52"
                    style={{ paddingLeft: 8 + depth * 12 }}
                  >
                    {status && <status.icon className={cn("size-3 shrink-0", status.className)} />}
                    <span className="truncate">{project.title}</span>
                  </button>
                  <div className="relative h-8 flex-1 border-l">
                    {today >= start && today < end && <span className="absolute inset-y-0 w-px bg-primary/60" style={{ left: `${pct(today)}%` }} />}
                    {visible && (
                      <span
                        className={cn(
                          "absolute top-2 h-4 rounded-full",
                          project.completedAt || project.status === "done" ? "bg-success/40" : late ? "bg-destructive/40" : "bg-primary/30"
                        )}
                        style={{ left: `${pct(s)}%`, width: `${Math.max(pct(e) - pct(s), 1)}%` }}
                        title={`${formatDay(s, true)} → ${formatDay(e, true)}`}
                      />
                    )}
                    {(tasksByProject.get(project.id) || []).map((t) => {
                      const due = toDay(t.dueDate)!
                      if (due < start || due >= end) return null
                      return (
                        <span
                          key={t.id}
                          className={cn("absolute top-3 size-2 -translate-x-1/2 rotate-45", t.status === "done" ? "bg-success" : due < today ? "bg-destructive" : "bg-foreground/70")}
                          style={{ left: `${pct(due)}%` }}
                          title={`${t.title} · ${formatDay(due)}`}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
