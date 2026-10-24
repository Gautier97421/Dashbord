"use client"

import { useMemo, useState } from "react"
import { closestCenter, DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, LayoutList, List, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useApp } from "@/lib/store-api"
import { useToast } from "@/hooks/use-toast"
import type { Project, Task } from "@/lib/types"
import { useProjectsUI } from "./context"
import { TaskRow } from "./task-row"

type Show = "open" | "done" | "all"

const byOrder = (a: Task, b: Task) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt)

/** Tâches d'un projet : ajout rapide, filtre, ordre libre par glisser-déposer. */
export function ProjectTasks({ project, treeIds, hasChildren }: { project: Project; treeIds: Set<string>; hasChildren: boolean }) {
  const { addTask, reorderTasks } = useApp()
  const { tasks, compactTasks, setCompactTasks } = useProjectsUI()
  const { toast } = useToast()
  const [show, setShow] = useState<Show>("open")
  const [withChildren, setWithChildren] = useState(false)
  const [title, setTitle] = useState("")

  const list = useMemo(
    () =>
      tasks
        .filter((t) => (withChildren ? t.projectId && treeIds.has(t.projectId) : t.projectId === project.id))
        .filter((t) => (show === "all" ? true : show === "done" ? t.status === "done" : t.status !== "done"))
        .sort(byOrder),
    [tasks, withChildren, treeIds, project.id, show]
  )
  const counts = useMemo(() => {
    const own = tasks.filter((t) => (withChildren ? t.projectId && treeIds.has(t.projectId) : t.projectId === project.id))
    return { open: own.filter((t) => t.status !== "done").length, done: own.filter((t) => t.status === "done").length, all: own.length }
  }, [tasks, withChildren, treeIds, project.id])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const add = async () => {
    const value = title.trim()
    if (!value) return
    setTitle("")
    try {
      await addTask({ title: value, status: "todo", priority: "medium", projectId: project.id })
    } catch {
      setTitle(value)
      toast({ title: "Tâche non ajoutée", variant: "destructive" })
    }
  }

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = list.map((t) => t.id)
    const moved = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    const current = new Map(list.map((t) => [t.id, t.order ?? 0]))
    try {
      await reorderTasks(moved.map((id, order) => ({ id, order })).filter((i) => current.get(i.id) !== i.order))
    } catch {
      toast({ title: "Ordre non enregistré", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Ajouter une tâche…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        <Button variant="outline" size="icon" onClick={add} disabled={!title.trim()} aria-label="Ajouter la tâche">
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={show} onValueChange={(v) => v && setShow(v as Show)}>
          <ToggleGroupItem value="open">À faire {counts.open}</ToggleGroupItem>
          <ToggleGroupItem value="done">Terminées {counts.done}</ToggleGroupItem>
          <ToggleGroupItem value="all">Toutes</ToggleGroupItem>
        </ToggleGroup>
        {hasChildren && (
          <Label className="flex items-center gap-2 text-xs font-normal">
            <Switch checked={withChildren} onCheckedChange={setWithChildren} />
            Sous-projets inclus
          </Label>
        )}
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="ml-auto"
          value={compactTasks ? "compact" : "detailed"}
          onValueChange={(v) => v && setCompactTasks(v === "compact")}
          aria-label="Affichage"
        >
          <ToggleGroupItem value="compact" aria-label="Affichage compact">
            <List className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="detailed" aria-label="Affichage détaillé">
            <LayoutList className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {show === "done" ? "Aucune tâche terminée" : counts.all === 0 ? "Aucune tâche pour ce projet" : "Tout est fait 🎉"}
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className={compactTasks ? "space-y-1" : "space-y-1.5"}>
              {list.map((t) => (
                <SortableTaskRow key={t.id} task={t} showProject={withChildren && t.projectId !== project.id} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

function SortableTaskRow({ task, showProject }: { task: Task; showProject: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    // Translation seule : sans l'échelle, l'élément déplacé garde sa taille (sinon il prend celle de l'élément survolé)
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={isDragging ? "relative z-10 opacity-80" : undefined}>
      <TaskRow
        task={task}
        showProject={showProject}
        dragHandle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="-ml-1 mt-0.5 cursor-grab touch-none text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
            aria-label={`Déplacer ${task.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  )
}
