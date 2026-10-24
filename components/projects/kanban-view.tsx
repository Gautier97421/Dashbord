"use client"

import { useEffect, useMemo, useState } from "react"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { MoveRight, Plus, Search, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useApp } from "@/lib/store-api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { daysBetween, projectTreeIds, toDay } from "@/lib/projects/core"
import { normalizeSearch, TASK_STATUSES, taskStatusMeta } from "@/lib/projects/meta"
import type { Task, TaskStatus } from "@/lib/types"
import { projectPath, useProjectsUI } from "./context"
import { ProjectPicker } from "./project-picker"
import { TaskDeleteButton, TaskIndicators, TaskMenu } from "./task-row"
import { useTaskActions } from "./use-task-actions"
import { QuickAddTaskDialog, type QuickAddDefaults } from "./quick-add-task"

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "waiting", "done"]
// Colonne "Terminé" : seulement les tâches récentes, sauf demande contraire
const DONE_RECENT_DAYS = 14
// Au-delà, une colonne "En cours" / "En attente" est signalée comme engorgée
const PILE_UP = 6

type Columns = Record<TaskStatus, string[]>
const COLUMN_PREFIX = "col:"
// Le relâchement d'une carte déposée produit un clic : il ne doit pas ouvrir sa fiche
let lastDragEndAt = 0

const byOrder = (a: Task, b: Task) => (a.order ?? 0) - (b.order ?? 0) || b.createdAt.localeCompare(a.createdAt)

export function KanbanView() {
  const { state, reorderTasks } = useApp()
  const { tasks, today, projectById } = useProjectsUI()
  const { setStatus } = useTaskActions()
  const { toast } = useToast()
  const [projectId, setProjectId] = useState<string | undefined>()
  const [q, setQ] = useState("")
  const [showAllDone, setShowAllDone] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [quickAdd, setQuickAdd] = useState<QuickAddDefaults | null>(null)

  const visibleTasks = useMemo(() => {
    const scope = projectId ? projectTreeIds(state.projects, projectId) : null
    const query = normalizeSearch(q)
    return tasks.filter((t) => {
      if (scope && !(t.projectId && scope.has(t.projectId))) return false
      if (query && !normalizeSearch(t.title).includes(query)) return false
      if (t.status === "done" && !showAllDone) {
        const done = t.completedAt?.slice(0, 10)
        if (!done || daysBetween(done, today) > DONE_RECENT_DAYS) return false
      }
      return true
    })
  }, [tasks, projectId, q, showAllDone, state.projects, today])

  const taskById = useMemo(() => new Map(visibleTasks.map((t) => [t.id, t])), [visibleTasks])

  const fromTasks = useMemo((): Columns => {
    const cols = { todo: [], in_progress: [], waiting: [], done: [] } as Record<TaskStatus, Task[]>
    for (const t of visibleTasks) cols[t.status]?.push(t)
    return Object.fromEntries(COLUMNS.map((s) => [s, cols[s].sort(byOrder).map((t) => t.id)])) as Columns
  }, [visibleTasks])

  // Pendant un glisser-déposer, la carte change de colonne localement ; le reste du temps on suit le store
  const [columns, setColumns] = useState<Columns>(fromTasks)
  useEffect(() => {
    if (!activeId) setColumns(fromTasks)
  }, [fromTasks, activeId])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Appui long sur mobile : un simple glissement fait défiler les colonnes
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const containerOf = (id: string, cols = columns): TaskStatus | undefined => {
    if (id.startsWith(COLUMN_PREFIX)) return id.slice(COLUMN_PREFIX.length) as TaskStatus
    return COLUMNS.find((s) => cols[s].includes(id))
  }

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const from = containerOf(String(active.id))
    const to = containerOf(String(over.id))
    if (!from || !to || from === to) return
    setColumns((cols) => {
      const fromItems = cols[from].filter((id) => id !== active.id)
      const overIndex = cols[to].indexOf(String(over.id))
      const toItems = [...cols[to]]
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, String(active.id))
      return { ...cols, [from]: fromItems, [to]: toItems }
    })
  }

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    const id = String(active.id)
    const task = taskById.get(id)
    const column = containerOf(id)
    let finalColumns = columns
    if (over && column) {
      const overColumn = containerOf(String(over.id))
      if (overColumn === column && !String(over.id).startsWith(COLUMN_PREFIX)) {
        const items = columns[column]
        const oldIndex = items.indexOf(id)
        const newIndex = items.indexOf(String(over.id))
        if (oldIndex !== newIndex) finalColumns = { ...columns, [column]: arrayMove(items, oldIndex, newIndex) }
      }
    }
    setColumns(finalColumns)
    setActiveId(null)
    lastDragEndAt = Date.now()
    if (!task || !column || !over) return

    try {
      if (task.status !== column) await setStatus(task, column)
      const items = finalColumns[column].map((taskId, order) => ({ id: taskId, order })).filter((i) => taskById.get(i.id)?.order !== i.order)
      await reorderTasks(items)
    } catch {
      toast({ title: "Déplacement non enregistré", description: "Réessaie dans un instant.", variant: "destructive" })
    }
  }

  const activeTask = activeId ? taskById.get(activeId) : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-48">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Filtrer…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <ProjectPicker
          value={projectId}
          onChange={(id) => setProjectId(id || undefined)}
          noneLabel="Tous les projets"
          includeArchived
          size="sm"
          className="w-[min(14rem,60vw)]"
        />
        <Button variant="outline" size="sm" onClick={() => setShowAllDone((v) => !v)}>
          {showAllDone ? "Terminées récentes seulement" : "Toutes les terminées"}
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null)
          setColumns(fromTasks)
        }}
      >
        {/* Mobile : colonnes côte à côte qui défilent ; grand écran : 4 colonnes */}
        <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2 @4xl/main:mx-0 @4xl/main:grid @4xl/main:grid-cols-4 @4xl/main:overflow-visible @4xl/main:px-0">
          {COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              ids={columns[status]}
              taskById={taskById}
              today={today}
              onAdd={() => setQuickAdd({ status, projectId })}
              projectLabel={(t) => (projectId ? null : projectPath(t.projectId, projectById))}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeTask && <KanbanCardContent task={activeTask} projectLabel={projectPath(activeTask.projectId, projectById)} overlay />}
        </DragOverlay>
      </DndContext>

      <QuickAddTaskDialog open={!!quickAdd} onOpenChange={(o) => !o && setQuickAdd(null)} defaults={quickAdd || undefined} onCreated={() => {}} />
    </div>
  )
}

function KanbanColumn({
  status,
  ids,
  taskById,
  today,
  onAdd,
  projectLabel,
}: {
  status: TaskStatus
  ids: string[]
  taskById: Map<string, Task>
  today: string
  onAdd: () => void
  projectLabel: (t: Task) => string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${status}` })
  const meta = taskStatusMeta(status)
  const overdue = ids.filter((id) => {
    const due = toDay(taskById.get(id)?.dueDate)
    return status !== "done" && !!due && due < today
  }).length
  const pilingUp = (status === "in_progress" || status === "waiting") && ids.length >= PILE_UP

  return (
    <section
      ref={setNodeRef}
      className={cn("flex w-[82vw] max-w-sm shrink-0 snap-start flex-col rounded-xl border bg-muted/30 sm:w-72 @4xl/main:w-auto @4xl/main:max-w-none", isOver && "ring-2 ring-primary/40")}
      aria-label={`Colonne ${meta.label}`}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <meta.icon className={cn("size-4", meta.className)} />
        <h3 className="text-sm font-semibold">{meta.label}</h3>
        <span
          className={cn("rounded-full px-1.5 text-xs tabular-nums", pilingUp ? "bg-warning/20 text-warning-foreground dark:text-warning" : "text-muted-foreground")}
          title={pilingUp ? "Les tâches s'accumulent dans cette colonne" : undefined}
        >
          {ids.length}
        </span>
        {overdue > 0 && (
          <span className="flex items-center gap-1 text-xs text-destructive" title={`${overdue} en retard`}>
            <TriangleAlert className="size-3" />
            {overdue}
          </span>
        )}
        {status !== "done" && (
          <Button variant="ghost" size="icon" className="ml-auto size-7" onClick={onAdd} aria-label={`Ajouter une tâche « ${meta.label} »`}>
            <Plus className="size-4" />
          </Button>
        )}
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
          {ids.map((id) => {
            const task = taskById.get(id)
            return task ? <KanbanCard key={id} task={task} projectLabel={projectLabel(task)} /> : null
          })}
          {ids.length === 0 && <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">Dépose une tâche ici</p>}
        </div>
      </SortableContext>
    </section>
  )
}

function KanbanCard({ task, projectLabel }: { task: Task; projectLabel: string | null }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      // Translation seule : sans l'échelle, l'élément déplacé garde sa taille (sinon il prend celle de l'élément survolé)
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <KanbanCardContent task={task} projectLabel={projectLabel} />
    </div>
  )
}

function KanbanCardContent({ task, projectLabel, overlay = false }: { task: Task; projectLabel: string | null; overlay?: boolean }) {
  const { openTask } = useProjectsUI()
  const { setStatus } = useTaskActions()
  const done = task.status === "done"
  return (
    <div
      className={cn("group cursor-grab rounded-lg border bg-card p-2.5 shadow-xs active:cursor-grabbing", overlay && "rotate-2 shadow-lg")}
      onClick={() => !overlay && Date.now() - lastDragEndAt > 300 && openTask(task.id)}
    >
      <div className="flex items-start gap-1">
        <p className={cn("min-w-0 flex-1 text-sm font-medium", done && "text-muted-foreground line-through")}>{task.title}</p>
        {!overlay && (
          // Les menus ne doivent ni ouvrir la fiche ni lancer un glisser-déposer
          <div className="-mr-1 -mt-1 flex" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 opacity-60 group-hover:opacity-100" aria-label={`Déplacer ${task.title}`}>
                  <MoveRight className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Déplacer vers</DropdownMenuLabel>
                {TASK_STATUSES.filter((s) => s.value !== task.status).map(({ value, label, icon: Icon, className }) => (
                  <DropdownMenuItem key={value} onClick={() => setStatus(task, value)}>
                    <Icon className={cn("size-4", className)} />
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <TaskMenu task={task} triggerClassName="opacity-60 group-hover:opacity-100" />
            <TaskDeleteButton task={task} />
          </div>
        )}
      </div>
      {projectLabel && <p className="mt-0.5 truncate text-xs text-muted-foreground">{projectLabel}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 empty:hidden">
        <TaskIndicators task={task} compact />
      </div>
    </div>
  )
}
