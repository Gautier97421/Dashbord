"use client"

import { useMemo, useState } from "react"
import { ArrowDownUp, LayoutList, List, ListFilter, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useApp } from "@/lib/store-api"
import { cn } from "@/lib/utils"
import { addDays, daysBetween, endOfWeek, PRIORITY_RANK, projectTreeIds, toDay } from "@/lib/projects/core"
import { normalizeSearch, PRIORITIES, TASK_STATUSES } from "@/lib/projects/meta"
import type { Priority, Task, TaskStatus } from "@/lib/types"
import { projectPath, useProjectsUI } from "./context"
import { ProjectPicker } from "./project-picker"
import { TaskRow } from "./task-row"
import { SavedViewsMenu } from "./saved-views"

export type TaskPreset = "all" | "today" | "week" | "overdue" | "priority" | "nodate" | "recent"
type TaskSort = "due" | "priority" | "project" | "created"

export interface TaskFilters {
  preset: TaskPreset
  projectId?: string
  statuses?: TaskStatus[]
  priorities?: Priority[]
  q?: string
  sort: TaskSort
  showDone?: boolean
}

const DEFAULT_FILTERS: TaskFilters = { preset: "today", sort: "due" }

const PRESETS: { value: TaskPreset; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "overdue", label: "En retard" },
  { value: "priority", label: "Prioritaires" },
  { value: "nodate", label: "Sans échéance" },
  { value: "recent", label: "Terminées récemment" },
  { value: "all", label: "Toutes" },
]

const RECENT_DAYS = 7

function matchesPreset(t: Task, preset: TaskPreset, today: string): boolean {
  const due = toDay(t.dueDate)
  const open = t.status !== "done"
  switch (preset) {
    // Aujourd'hui et Cette semaine montrent aussi les retards : ils sont à faire maintenant
    case "today":
      return open && !!due && due <= today
    case "week":
      return open && !!due && due <= endOfWeek(today)
    case "overdue":
      return open && !!due && due < today
    case "priority":
      return open && (t.priority === "high" || t.priority === "urgent")
    case "nodate":
      return open && !due
    case "recent":
      return t.status === "done" && !!t.completedAt && daysBetween(t.completedAt.slice(0, 10), today) <= RECENT_DAYS
    default:
      return true
  }
}

function dueBucket(t: Task, today: string): string {
  const due = toDay(t.dueDate)
  if (!due) return "Sans échéance"
  if (due < today) return "En retard"
  if (due === today) return "Aujourd'hui"
  if (due === addDays(today, 1)) return "Demain"
  if (due <= endOfWeek(today)) return "Cette semaine"
  return "Plus tard"
}
const BUCKET_ORDER = ["En retard", "Aujourd'hui", "Demain", "Cette semaine", "Plus tard", "Sans échéance"]

export function MyTasksView() {
  const { state, addTask } = useApp()
  const { tasks, today, projectById, compactTasks, setCompactTasks } = useProjectsUI()
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS)
  const [newTitle, setNewTitle] = useState("")
  const set = (changes: Partial<TaskFilters>) => setFilters((f) => ({ ...f, ...changes }))

  const scopeIds = useMemo(
    () => (filters.projectId ? projectTreeIds(state.projects, filters.projectId) : null),
    [filters.projectId, state.projects]
  )

  // Filtres hors préréglage (projet, statut, priorité, recherche), pour les compteurs des préréglages
  const base = useMemo(() => {
    const q = filters.q ? normalizeSearch(filters.q) : ""
    return tasks.filter((t) => {
      if (scopeIds && !(t.projectId && scopeIds.has(t.projectId))) return false
      if (filters.statuses?.length && !filters.statuses.includes(t.status)) return false
      if (filters.priorities?.length && !filters.priorities.includes(t.priority)) return false
      if (q && !normalizeSearch(`${t.title} ${t.description || ""} ${t.notes || ""}`).includes(q)) return false
      return true
    })
  }, [tasks, scopeIds, filters.statuses, filters.priorities, filters.q])

  // Compteurs : tâches ouvertes de chaque préréglage (terminées pour "Terminées récemment")
  const counts = useMemo(
    () =>
      Object.fromEntries(
        PRESETS.map((p) => [p.value, base.filter((t) => matchesPreset(t, p.value, today) && (p.value === "recent" || t.status !== "done")).length])
      ),
    [base, today]
  )

  const visible = useMemo(() => {
    const list = base.filter((t) => matchesPreset(t, filters.preset, today)).filter((t) => filters.preset === "recent" || filters.showDone || t.status !== "done")
    const byDue = (a: Task, b: Task) => (toDay(a.dueDate) || "9999").localeCompare(toDay(b.dueDate) || "9999")
    const byPriority = (a: Task, b: Task) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    const sorted = [...list]
    if (filters.preset === "recent") sorted.sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))
    else if (filters.sort === "due") sorted.sort((a, b) => byDue(a, b) || byPriority(a, b))
    else if (filters.sort === "priority") sorted.sort((a, b) => byPriority(a, b) || byDue(a, b))
    else if (filters.sort === "project") {
      sorted.sort((a, b) => (projectPath(a.projectId, projectById) || "~").localeCompare(projectPath(b.projectId, projectById) || "~") || byDue(a, b))
    } else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return sorted
  }, [base, filters.preset, filters.sort, filters.showDone, today, projectById])

  // Regroupement par échéance (tri par échéance) ou par projet (tri par projet)
  const groups = useMemo(() => {
    if (filters.preset === "recent" || (filters.sort !== "due" && filters.sort !== "project")) return [{ label: null as string | null, tasks: visible }]
    const map = new Map<string, Task[]>()
    for (const t of visible) {
      const key = filters.sort === "due" ? dueBucket(t, today) : projectPath(t.projectId, projectById) || "Sans projet"
      map.set(key, [...(map.get(key) || []), t])
    }
    const keys = [...map.keys()]
    if (filters.sort === "due") keys.sort((a, b) => BUCKET_ORDER.indexOf(a) - BUCKET_ORDER.indexOf(b))
    return keys.map((label) => ({ label, tasks: map.get(label)! }))
  }, [visible, filters.preset, filters.sort, today, projectById])

  const quickAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    setNewTitle("")
    await addTask({
      title,
      status: "todo",
      priority: filters.preset === "priority" ? "high" : "medium",
      dueDate: filters.preset === "today" ? today : undefined,
      projectId: filters.projectId,
    })
  }

  const activeExtra = (filters.statuses?.length || 0) + (filters.priorities?.length || 0) + (filters.showDone ? 1 : 0)

  return (
    <div className="space-y-4">
      {/* Préréglages : défilement horizontal sur mobile */}
      <div className="-mx-2 flex gap-1.5 overflow-x-auto px-2 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => set({ preset: p.value })}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
              filters.preset === p.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              p.value === "overdue" && counts.overdue > 0 && filters.preset !== "overdue" && "border-destructive/40 text-destructive"
            )}
          >
            {p.label}
            <span className={cn("text-xs tabular-nums", filters.preset === p.value ? "opacity-80" : "text-muted-foreground")}>{counts[p.value]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-48">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Filtrer les tâches…" value={filters.q || ""} onChange={(e) => set({ q: e.target.value })} className="pl-8" />
        </div>
        <ProjectPicker
          value={filters.projectId}
          onChange={(id) => set({ projectId: id || undefined })}
          noneLabel="Tous les projets"
          includeArchived
          size="sm"
          className="w-[min(14rem,55vw)]"
        />
        <Select value={filters.sort} onValueChange={(v) => set({ sort: v as TaskSort })}>
          <SelectTrigger className="w-auto" size="sm" aria-label="Trier">
            <ArrowDownUp className="size-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due">Échéance</SelectItem>
            <SelectItem value="priority">Priorité</SelectItem>
            <SelectItem value="project">Projet</SelectItem>
            <SelectItem value="created">Plus récentes</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn(activeExtra > 0 && "border-primary text-primary")}>
              <ListFilter className="size-4" />
              <span className="hidden sm:inline">Filtres</span>
              {activeExtra > 0 && <span className="text-xs">{activeExtra}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Statut</p>
              {TASK_STATUSES.map(({ value, label, icon: Icon, className }) => (
                <Label key={value} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={filters.statuses?.includes(value) || false}
                    onCheckedChange={(c) => set({ statuses: c ? [...(filters.statuses || []), value] : filters.statuses?.filter((s) => s !== value) })}
                  />
                  <Icon className={cn("size-4", className)} />
                  {label}
                </Label>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Priorité</p>
              {PRIORITIES.map(({ value, label }) => (
                <Label key={value} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={filters.priorities?.includes(value) || false}
                    onCheckedChange={(c) => set({ priorities: c ? [...(filters.priorities || []), value] : filters.priorities?.filter((p) => p !== value) })}
                  />
                  {label}
                </Label>
              ))}
            </div>
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox checked={!!filters.showDone} onCheckedChange={(c) => set({ showDone: !!c })} />
              Afficher les tâches terminées
            </Label>
            {activeExtra > 0 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => set({ statuses: undefined, priorities: undefined, showDone: false })}>
                Effacer les filtres
              </Button>
            )}
          </PopoverContent>
        </Popover>
        <SavedViewsMenu<TaskFilters> scope="tasks" current={filters} onApply={(f) => setFilters({ ...DEFAULT_FILTERS, ...f })} />
        <ToggleGroup type="single" variant="outline" size="sm" value={compactTasks ? "compact" : "detailed"} onValueChange={(v) => v && setCompactTasks(v === "compact")} aria-label="Affichage">
          <ToggleGroupItem value="compact" aria-label="Affichage compact" title="Affichage compact">
            <List className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="detailed" aria-label="Affichage détaillé" title="Affichage détaillé">
            <LayoutList className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filters.preset !== "recent" && (
        <div className="flex gap-2">
          <Input
            placeholder={
              filters.preset === "today"
                ? "Ajouter une tâche pour aujourd'hui…"
                : filters.projectId
                  ? `Ajouter une tâche à « ${projectById.get(filters.projectId)?.title} »…`
                  : "Ajouter une tâche…"
            }
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickAdd())}
          />
          <Button variant="outline" size="icon" onClick={quickAdd} disabled={!newTitle.trim()} aria-label="Ajouter la tâche">
            <Plus className="size-4" />
          </Button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          {filters.preset === "today" ? "Rien à faire aujourd'hui 🎉" : filters.preset === "overdue" ? "Aucune tâche en retard" : "Aucune tâche ne correspond"}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label || "all"} className="space-y-1.5">
              {group.label && (
                <h3 className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide", group.label === "En retard" ? "text-destructive" : "text-muted-foreground")}>
                  {group.label}
                  <span className="font-normal tabular-nums">{group.tasks.length}</span>
                </h3>
              )}
              <div className={compactTasks ? "space-y-1" : "space-y-1.5"}>
                {group.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} showProject={filters.sort !== "project"} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
