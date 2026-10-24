"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Archive,
  ArrowDownUp,
  BookmarkPlus,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CopyPlus,
  Edit,
  Flag,
  FolderOpen,
  FolderPlus,
  FolderSymlink,
  FolderTree,
  GripVertical,
  LayoutList,
  List,
  ListFilter,
  Plus,
  Search,
  Star,
  Target,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProjectDeleteButton } from "./project-delete-button"
import { LinkFolderDialog, ProjectFolderButton } from "./project-folder"
import { projectFolder } from "@/lib/project-links"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import * as api from "@/lib/api"
import { useApp } from "@/lib/store-api"
import { cn } from "@/lib/utils"
import { formatDateFr } from "@/lib/helpers"
import { addDays, endOfWeek, PRIORITY_RANK, toDay } from "@/lib/projects/core"
import { normalizeSearch, PRIORITIES } from "@/lib/projects/meta"
import { PROJECT_STATUSES } from "@/lib/project-status"
import type { Priority, Project, ProjectLink, ProjectStatus } from "@/lib/types"
import { projectPath, useProjectsUI } from "./context"
import { ProjectPicker } from "./project-picker"
import { NO_STATUS, ProjectStatusPicker } from "./project-status-ui"
import { ProjectDetail } from "./project-detail"
import { ResourceLinks } from "./resource-links"
import { SavedViewsMenu } from "./saved-views"
import { SaveAsTemplateDialog } from "./templates-view"
import { CLEARED } from "./use-task-actions"
import { PriorityBadge } from "./task-row"
import { keepFirstCycle, Lottie, MoreDots } from "@/components/lottie"

const NO_PRIORITY = "none"
// Au-delà, l'indentation n'augmente plus (lisibilité sur mobile)
const MAX_INDENT_DEPTH = 4
// Préférence locale : affichage de la liste des projets ("compact" ou "detailed")
const DENSITY_KEY = "dashlife:projectsDensity"

type StatusFilter = ProjectStatus | "none"
type ProjectSort = "manual" | "name" | "deadline" | "priority" | "progress" | "updated"

export interface ProjectFilters {
  q?: string
  statuses?: StatusFilter[]
  priorities?: Priority[]
  categories?: string[]
  due?: "overdue" | "week" | "month" | "none"
  favorites?: boolean
  includeArchived?: boolean
  sort: ProjectSort
}

const DEFAULT_FILTERS: ProjectFilters = { sort: "manual" }

const BUILTIN_VIEWS: { name: string; filters: ProjectFilters }[] = [
  { name: "Tous les projets", filters: DEFAULT_FILTERS },
  { name: "Projets actifs", filters: { statuses: ["not_started", "in_progress", "none"], sort: "manual" } },
  { name: "Urgences", filters: { priorities: ["urgent", "high"], sort: "deadline" } },
  { name: "En retard", filters: { due: "overdue", sort: "deadline" } },
  { name: "Projets terminés", filters: { statuses: ["done"], includeArchived: true, sort: "updated" } },
]

const isDefault = (f: ProjectFilters) =>
  !f.q && !f.statuses?.length && !f.priorities?.length && !f.categories?.length && !f.due && !f.favorites && !f.includeArchived && f.sort === "manual"

// Contenu assez large (menu latéral ouvert ou non) : liste et détail côte à côte ; sinon le détail
// remplace la liste. Même seuil que les classes @4xl/main (56rem) de la mise en page.
const WIDE_CONTENT_PX = 896

function useWideLayout() {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const main = document.querySelector("main")
    if (!main) return
    const observer = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= WIDE_CONTENT_PX))
    observer.observe(main)
    return () => observer.disconnect()
  }, [])
  return wide
}

interface FormState {
  title: string
  description: string
  notes: string
  objectives: string[]
  deadline: string
  startDate: string
  parentId: string | null
  status: ProjectStatus | null
  priority: Priority | null
  category: string
  links: ProjectLink[]
  // Tâches à créer avec un nouveau projet
  tasks: string[]
}

const emptyForm = (parentId: string | null = null): FormState => ({
  title: "",
  description: "",
  notes: "",
  objectives: [],
  deadline: "",
  startDate: "",
  parentId,
  status: null,
  priority: null,
  category: "",
  links: [],
  tasks: [],
})

interface TreeProps {
  getChildren: (id: string | null) => Project[]
  expanded: Set<string>
  listGap: string
  compact: boolean
  cardClass: (project: Project) => string
  renderCardContent: (project: Project, depth: number, opts: { tree: boolean; handle?: React.ReactNode }) => React.ReactNode
  onSelect: (id: string) => void
}

// Projet de l'arborescence (avec ses sous-projets dépliés), déplaçable parmi ses frères.
// Composant de module : défini dans le rendu, il serait recréé (et le glisser-déposer interrompu) à chaque image.
function SortableProject({ project, depth, tree }: { project: Project; depth: number; tree: TreeProps }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const children = tree.getChildren(project.id)
  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      onClick={(e) => e.stopPropagation()}
      className={cn("-ml-1.5 shrink-0 cursor-grab touch-none text-muted-foreground/50 hover:text-foreground active:cursor-grabbing", !tree.compact && "mt-0.5")}
      aria-label={`Déplacer ${project.title}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  )
  return (
    // Translation seule : sans l'échelle, l'élément déplacé garde sa taille (sinon il prend celle de l'élément survolé)
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn(tree.listGap, isDragging && "relative z-10 opacity-80")}>
      <Card className={tree.cardClass(project)} style={depth ? { marginLeft: Math.min(depth, MAX_INDENT_DEPTH) * 16 } : undefined} onClick={() => tree.onSelect(project.id)}>
        {tree.renderCardContent(project, depth, { tree: true, handle })}
      </Card>
      {tree.expanded.has(project.id) && children.length > 0 && (
        <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className={tree.listGap}>
            {children.map((child) => (
              <SortableProject key={child.id} project={child} depth={depth + 1} tree={tree} />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  )
}

// createRequest : demande d'ouverture du formulaire "Nouveau projet", consommée (onCreateHandled) pour ne pas
// rouvrir le formulaire à chaque retour sur l'onglet Projets
export function ProjectsBrowser({ createRequest, onCreateHandled }: { createRequest?: number; onCreateHandled?: () => void }) {
  const { state, addProject, updateProject, deleteProject, addTask, reorderProjects, refresh } = useApp()
  const ui = useProjectsUI()
  const { selectedProjectId, setSelectedProjectId, projectStats, alertsByProject, today } = ui
  const { toast } = useToast()
  const wide = useWideLayout()

  const [compact, setCompact] = useState(true)
  const [filters, setFilters] = useState<ProjectFilters>(DEFAULT_FILTERS)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showArchived, setShowArchived] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [newObjective, setNewObjective] = useState("")
  const [newTask, setNewTask] = useState("")
  const [templateFor, setTemplateFor] = useState<string | null>(null)
  const [folderFor, setFolderFor] = useState<Project | null>(null)

  // Lu après le montage : localStorage n'existe pas pendant le rendu serveur
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DENSITY_KEY)
      if (stored) setCompact(stored !== "detailed")
    } catch {
      /* ignore */
    }
  }, [])

  const changeDensity = (value: string) => {
    // ToggleGroup renvoie "" quand on reclique sur l'option active
    if (!value) return
    setCompact(value === "compact")
    try {
      localStorage.setItem(DENSITY_KEY, value)
    } catch {
      /* ignore */
    }
  }

  const byOrder = (a: Project, b: Project) => (a.order ?? 0) - (b.order ?? 0) || b.createdAt.localeCompare(a.createdAt)

  // Arborescence : enfants de chaque projet (clé null = projets racines, y compris ceux dont le parent n'existe plus)
  const childrenByParent = useMemo(() => {
    const ids = new Set(state.projects.map((p) => p.id))
    const map = new Map<string | null, Project[]>()
    for (const p of state.projects) {
      const key = p.parentId && ids.has(p.parentId) ? p.parentId : null
      map.set(key, [...(map.get(key) || []), p])
    }
    for (const list of map.values()) list.sort(byOrder)
    return map
  }, [state.projects])

  const getChildren = useCallback((id: string | null) => childrenByParent.get(id) || [], [childrenByParent])

  const getDescendantIds = useCallback(
    (id: string): string[] => {
      const result: string[] = []
      const stack = [id]
      while (stack.length) {
        const cur = stack.pop()!
        for (const child of getChildren(cur)) {
          result.push(child.id)
          stack.push(child.id)
        }
      }
      return result
    },
    [getChildren]
  )

  const getAncestorIds = useCallback(
    (id: string): string[] => {
      const result: string[] = []
      let cur = ui.projectById.get(id)?.parentId
      while (cur && ui.projectById.has(cur) && !result.includes(cur)) {
        result.unshift(cur)
        cur = ui.projectById.get(cur)!.parentId
      }
      return result
    },
    [ui.projectById]
  )

  const activeRoots = getChildren(null).filter((p) => !p.completedAt)
  const archivedRoots = getChildren(null).filter((p) => p.completedAt)
  const favorites = state.projects.filter((p) => p.favorite && !p.completedAt).sort(byOrder)
  const categories = useMemo(() => [...new Set(state.projects.map((p) => p.category).filter((c): c is string => !!c))].sort(), [state.projects])
  const filtering = !isDefault(filters)

  // Ouvre un projet en dépliant ses parents dans la liste
  const selectProject = useCallback(
    (id: string) => {
      setSelectedProjectId(id)
      const ancestorIds = getAncestorIds(id)
      if (ancestorIds.length) setExpanded((prev) => new Set([...prev, ...ancestorIds]))
    },
    [setSelectedProjectId, getAncestorIds]
  )

  // Sélection venue d'ailleurs (vue d'ensemble, recherche, notification) : on déplie ses parents
  useEffect(() => {
    if (selectedProjectId) {
      const ancestorIds = getAncestorIds(selectedProjectId)
      if (ancestorIds.length) setExpanded((prev) => (ancestorIds.every((id) => prev.has(id)) ? prev : new Set([...prev, ...ancestorIds])))
    }
  }, [selectedProjectId, getAncestorIds])

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Filtres ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!filtering) return []
    const q = filters.q ? normalizeSearch(filters.q) : ""
    const list = state.projects.filter((p) => {
      if (!filters.includeArchived && p.completedAt && !filters.statuses?.includes("done")) return false
      if (filters.favorites && !p.favorite) return false
      if (filters.statuses?.length && !filters.statuses.includes((p.status ?? "none") as StatusFilter)) {
        // "Terminés" inclut les projets archivés
        if (!(filters.statuses.includes("done") && p.completedAt)) return false
      }
      if (filters.priorities?.length && !(p.priority && filters.priorities.includes(p.priority))) return false
      if (filters.categories?.length && !(p.category && filters.categories.includes(p.category))) return false
      if (filters.due) {
        const d = toDay(p.deadline)
        if (filters.due === "none" ? !!d : !d) return false
        if (d && filters.due === "overdue" && !(d < today && !p.completedAt && p.status !== "done")) return false
        if (d && filters.due === "week" && !(d >= today && d <= endOfWeek(today))) return false
        if (d && filters.due === "month" && !(d >= today && d <= addDays(today, 31))) return false
      }
      if (q && !normalizeSearch(`${p.title} ${p.description || ""} ${p.notes || ""} ${p.category || ""}`).includes(q)) return false
      return true
    })
    const progress = (p: Project) => projectStats.get(p.id)?.progress ?? -1
    const sorters: Record<ProjectSort, (a: Project, b: Project) => number> = {
      manual: byOrder,
      name: (a, b) => a.title.localeCompare(b.title, "fr"),
      deadline: (a, b) => (toDay(a.deadline) || "9999").localeCompare(toDay(b.deadline) || "9999"),
      priority: (a, b) => (b.priority ? PRIORITY_RANK[b.priority] : -1) - (a.priority ? PRIORITY_RANK[a.priority] : -1),
      progress: (a, b) => progress(b) - progress(a),
      updated: (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""),
    }
    return list.sort(sorters[filters.sort])
  }, [filtering, filters, state.projects, projectStats, today])

  const setFilter = (changes: Partial<ProjectFilters>) => setFilters((f) => ({ ...f, ...changes }))
  const extraFilters = (filters.statuses?.length || 0) + (filters.priorities?.length || 0) + (filters.categories?.length || 0) + (filters.due ? 1 : 0) + (filters.favorites ? 1 : 0) + (filters.includeArchived ? 1 : 0)

  // ─── Formulaire ────────────────────────────────────────────────────────────

  const openCreateDialog = useCallback((parentId: string | null = null) => {
    setEditingProject(null)
    setForm(emptyForm(parentId))
    setNewObjective("")
    setNewTask("")
    setIsDialogOpen(true)
  }, [])

  // Bouton "Nouveau projet" de l'en-tête de la section
  useEffect(() => {
    if (!createRequest) return
    openCreateDialog()
    onCreateHandled?.()
  }, [createRequest, openCreateDialog, onCreateHandled])

  const openEditDialog = (project: Project) => {
    setEditingProject(project)
    setForm({
      title: project.title,
      description: project.description || "",
      notes: project.notes || "",
      objectives: project.objectives,
      deadline: toDay(project.deadline) || "",
      startDate: toDay(project.startDate) || "",
      parentId: project.parentId ?? null,
      status: project.status ?? null,
      priority: project.priority ?? null,
      category: project.category || "",
      links: project.links ?? [],
      tasks: [],
    })
    setNewObjective("")
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingProject(null)
  }

  // Objectif ou tâche en cours de saisie, si l'utilisateur n'a pas cliqué sur "+"
  const pendingList = (list: string[], pending: string) => (pending.trim() ? [...list, pending.trim()] : list)

  const handleSave = async () => {
    if (!form.title.trim()) return
    const fields = {
      title: form.title.trim(),
      description: form.description.trim() || CLEARED,
      notes: form.notes.trim() || CLEARED,
      objectives: pendingList(form.objectives, newObjective),
      deadline: form.deadline || CLEARED,
      startDate: form.startDate || CLEARED,
      parentId: form.parentId,
      status: form.status,
      priority: form.priority,
      category: form.category.trim() || CLEARED,
      links: form.links,
    }
    try {
      if (editingProject) {
        await updateProject({ ...editingProject, ...fields })
      } else {
        const created = await addProject({ ...fields, tasks: [] })
        // Les tâches saisies dans le formulaire sont créées avec le projet
        for (const title of pendingList(form.tasks, newTask)) {
          await addTask({ title, status: "todo", priority: "medium", projectId: created.id })
        }
        selectProject(created.id)
      }
    } catch {
      toast({ title: "Enregistrement impossible", description: "Vérifie ta connexion puis réessaie.", variant: "destructive" })
      return
    }
    // Le parent est déplié pour voir le projet créé ou déplacé
    if (form.parentId) {
      const parentId = form.parentId
      setExpanded((prev) => new Set([...prev, parentId, ...getAncestorIds(parentId)]))
    }
    closeDialog()
  }

  // Parent impossible : le projet modifié lui-même et ses sous-projets (sinon boucle)
  const parentExclusions = useMemo(
    () => (editingProject ? new Set([editingProject.id, ...getDescendantIds(editingProject.id)]) : undefined),
    [editingProject, getDescendantIds]
  )

  // ─── Actions ───────────────────────────────────────────────────────────────

  const toggleArchive = (project: Project) =>
    updateProject({ ...project, completedAt: project.completedAt ? CLEARED : new Date().toISOString() })

  // Échéance affichée dans le calendrier principal
  const toggleCalendar = async (project: Project) => {
    const on = !project.showInCalendar
    try {
      await updateProject({ ...project, showInCalendar: on })
    } catch {
      toast({ title: "Modification impossible", variant: "destructive" })
      return
    }
    if (on) {
      const deadline = toDay(project.deadline)
      toast({
        title: "Ajouté au calendrier",
        description: deadline ? `Échéance visible le ${formatDateFr(`${deadline}T00:00`, "long")}.` : "Il y apparaîtra dès qu'il aura une échéance.",
      })
    }
  }

  const duplicateProject = async (project: Project) => {
    try {
      const { projectId } = await api.projectsApi.duplicate(project.id)
      await refresh()
      selectProject(projectId)
      toast({ title: "Projet dupliqué", description: `${project.title} (copie)` })
    } catch {
      toast({ title: "Duplication impossible", variant: "destructive" })
    }
  }

  const trashProject = async (project: Project) => {
    const removed = new Set([project.id, ...getDescendantIds(project.id)])
    try {
      await deleteProject(project.id)
    } catch {
      toast({ title: "Suppression impossible", variant: "destructive" })
      return
    }
    if (selectedProjectId && removed.has(selectedProjectId)) setSelectedProjectId(null)
    toast({
      title: "Projet mis à la corbeille",
      description: project.title,
      action: (
        <ToastAction
          altText="Annuler la suppression"
          onClick={async () => {
            await fetch("/api/trash", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "restore", type: "project", id: project.id }),
            })
            await refresh()
          }}
        >
          Annuler
        </ToastAction>
      ),
    })
  }

  // ─── Glisser-déposer (projets d'un même parent) ────────────────────────────

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const parentKey = useCallback((id: string) => {
    const p = ui.projectById.get(id)
    return p?.parentId && ui.projectById.has(p.parentId) ? p.parentId : null
  }, [ui.projectById])

  // Seuls les projets du même parent sont des cibles : on réordonne, on ne déplace pas
  const sameParentCollision: CollisionDetection = (args) =>
    closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => parentKey(String(c.id)) === parentKey(String(args.active.id))),
    })

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const parent = parentKey(String(active.id))
    if (parent !== parentKey(String(over.id))) return
    const siblings = getChildren(parent)
    const ids = siblings.map((p) => p.id)
    const moved = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    const current = new Map(siblings.map((p) => [p.id, p.order ?? 0]))
    try {
      await reorderProjects(moved.map((id, order) => ({ id, order })).filter((i) => current.get(i.id) !== i.order))
    } catch {
      toast({ title: "Ordre non enregistré", variant: "destructive" })
    }
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  const listGap = compact ? "space-y-1.5" : "space-y-2"

  const renderCardContent = (project: Project, depth: number, opts: { tree: boolean; handle?: React.ReactNode }) => {
    const stats = projectStats.get(project.id)
    const children = getChildren(project.id)
    const isExpanded = expanded.has(project.id)
    const alerts = alertsByProject.get(project.id) || []
    const worst = alerts.find((a) => a.severity === "high") || alerts.find((a) => a.severity === "medium") || alerts[0]
    const path = !opts.tree && project.parentId ? projectPath(project.parentId, ui.projectById) : null
    const deadline = toDay(project.deadline)

    const expandToggle = opts.tree && children.length > 0 ? (
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 -ml-1"
        onClick={(e) => {
          e.stopPropagation()
          toggleExpanded(project.id)
        }}
        aria-label={isExpanded ? "Replier les sous-projets" : "Déplier les sous-projets"}
        aria-expanded={isExpanded}
      >
        <ChevronRight className={cn("size-4 transition-transform", isExpanded && "rotate-90")} />
      </Button>
    ) : opts.tree && depth > 0 ? (
      <span className="size-7 shrink-0 -ml-1" />
    ) : null

    const statusPicker = <ProjectStatusPicker status={project.status} onChange={(status) => updateProject({ ...project, status })} showLabel={!compact} />

    const alertIcon = worst && (
      <span title={alerts.map((a) => a.body).join("\n")} className="shrink-0">
        <TriangleAlert className={cn("size-3.5", worst.severity === "high" ? "text-destructive" : worst.severity === "medium" ? "text-warning" : "text-muted-foreground")} />
      </span>
    )

    const actionsMenu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="size-7 shrink-0 hover:bg-transparent hover:text-foreground dark:hover:bg-transparent" aria-label={`Actions pour ${project.title}`}>
            <MoreDots />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => openCreateDialog(project.id)}>
            <FolderPlus className="size-4" />
            Nouveau sous-projet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEditDialog(project)}>
            <Edit className="size-4" />
            Modifier / déplacer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateProject({ ...project, favorite: !project.favorite })}>
            <Star className="size-4" />
            {project.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => duplicateProject(project)}>
            <CopyPlus className="size-4" />
            Dupliquer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTemplateFor(project.id)}>
            <BookmarkPlus className="size-4" />
            Enregistrer comme modèle
          </DropdownMenuItem>
          {!projectFolder(project.links) && (
            <DropdownMenuItem onClick={() => setFolderFor(project)}>
              <FolderSymlink className="size-4" />
              Lier un dossier de l&apos;ordinateur…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => toggleArchive(project)}>
            {project.completedAt ? <FolderOpen className="size-4" /> : <Archive className="size-4" />}
            {project.completedAt ? "Réactiver" : "Archiver"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={!!project.showInCalendar} onCheckedChange={() => toggleCalendar(project)}>
            Afficher dans le calendrier
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    // Dossier lié (s'il y en a un), le menu "…", puis la corbeille animée à sa droite
    const actions = (
      <span className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
        <ProjectFolderButton project={project} />
        {actionsMenu}
        <ProjectDeleteButton project={project} descendants={getDescendantIds(project.id).length} onDelete={() => trashProject(project)} />
      </span>
    )

    if (compact) {
      return (
        <CardContent className="flex items-center gap-2 px-3 py-2">
          {opts.handle}
          {expandToggle}
          {statusPicker}
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm font-medium", project.completedAt && "line-through")} title={project.title}>
              {project.title}
            </span>
            {path && <span className="block truncate text-xs text-muted-foreground">{path}</span>}
          </span>
          {project.favorite && <Star className="size-3.5 shrink-0 fill-warning text-warning" aria-label="Favori" />}
          {alertIcon}
          {/* Sans tâche, une progression de 0/0 n'apprend rien : on ne l'affiche pas */}
          {stats?.progress != null && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums" title={`${stats.done}/${stats.total} tâches terminées`}>
              <Progress value={stats.progress} className="hidden h-1.5 w-12 sm:block" />
              {stats.progress}%
            </span>
          )}
          {actions}
        </CardContent>
      )
    }

    return (
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          {opts.handle}
          {expandToggle}
          <div className="min-w-0 flex-1">
            <h3 className={cn("flex items-center gap-1.5 font-semibold", project.completedAt && "line-through")}>
              <span className="truncate">{project.title}</span>
              {project.favorite && <Star className="size-3.5 shrink-0 fill-warning text-warning" aria-label="Favori" />}
              {alertIcon}
            </h3>
            {path && <p className="truncate text-xs text-muted-foreground">{path}</p>}
            {project.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}
          </div>
          {actions}
        </div>

        {stats?.progress != null && (
          <div className="mt-3 flex items-center gap-2">
            <Progress value={stats.progress} className="h-1.5 flex-1" />
            <span className="text-xs font-medium tabular-nums">{stats.progress}%</span>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {statusPicker}
          <PriorityBadge priority={project.priority} />
          {project.category && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{project.category}</Badge>}
          {stats && stats.total > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3.5" />
              {stats.done}/{stats.total}
            </span>
          )}
          {children.length > 0 && (
            <span className="flex items-center gap-1">
              <FolderTree className="size-3.5" />
              {children.length} sous-projet{children.length > 1 ? "s" : ""}
            </span>
          )}
          {deadline && (
            <span className={cn("flex items-center gap-1", deadline < today && !project.completedAt && project.status !== "done" && "text-destructive")}>
              <Calendar className="size-3.5" />
              {formatDateFr(`${deadline}T00:00`, "short")}
            </span>
          )}
        </div>
      </CardContent>
    )
  }

  const cardClass = (project: Project) =>
    cn(
      "py-0 gap-0 cursor-pointer transition-all hover:shadow-md",
      compact && "rounded-lg shadow-none",
      selectedProjectId === project.id && "ring-2 ring-primary",
      project.completedAt && "opacity-60"
    )

  const tree: TreeProps = {
    getChildren,
    expanded,
    listGap,
    compact,
    cardClass,
    renderCardContent,
    onSelect: selectProject,
  }

  const flatCard = (project: Project) => (
    <Card key={project.id} className={cardClass(project)} onClick={() => selectProject(project.id)}>
      {renderCardContent(project, 0, { tree: false })}
    </Card>
  )

  const selectedProject = selectedProjectId ? ui.projectById.get(selectedProjectId) : undefined
  const showDetailOnly = !wide && !!selectedProject

  const list = (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-40">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Filtrer les projets…" value={filters.q || ""} onChange={(e) => setFilter({ q: e.target.value })} className="pl-8" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn(extraFilters > 0 && "border-primary text-primary")}>
              <ListFilter className="size-4" />
              Filtres
              {extraFilters > 0 && <span className="text-xs">{extraFilters}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="max-h-[70vh] w-72 space-y-3 overflow-y-auto">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">État</p>
              {[...PROJECT_STATUSES, { value: "none" as const, label: "Sans état", icon: null, className: "" }].map(({ value, label, icon: Icon, className }) => (
                <Label key={value} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={filters.statuses?.includes(value) || false}
                    onCheckedChange={(c) => setFilter({ statuses: c ? [...(filters.statuses || []), value] : filters.statuses?.filter((s) => s !== value) })}
                  />
                  {Icon && <Icon className={cn("size-4", className)} />}
                  {label}
                </Label>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Priorité</p>
              {PRIORITIES.map(({ value, label, className }) => (
                <Label key={value} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={filters.priorities?.includes(value) || false}
                    onCheckedChange={(c) => setFilter({ priorities: c ? [...(filters.priorities || []), value] : filters.priorities?.filter((p) => p !== value) })}
                  />
                  <Flag className={cn("size-4", className)} />
                  {label}
                </Label>
              ))}
            </div>
            {categories.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Catégorie</p>
                {categories.map((cat) => (
                  <Label key={cat} className="flex items-center gap-2 font-normal">
                    <Checkbox
                      checked={filters.categories?.includes(cat) || false}
                      onCheckedChange={(c) => setFilter({ categories: c ? [...(filters.categories || []), cat] : filters.categories?.filter((x) => x !== cat) })}
                    />
                    {cat}
                  </Label>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Échéance</p>
              <Select value={filters.due || "any"} onValueChange={(v) => setFilter({ due: v === "any" ? undefined : (v as ProjectFilters["due"]) })}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Toutes</SelectItem>
                  <SelectItem value="overdue">En retard</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Dans le mois</SelectItem>
                  <SelectItem value="none">Sans échéance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox checked={!!filters.favorites} onCheckedChange={(c) => setFilter({ favorites: !!c })} />
              Favoris seulement
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox checked={!!filters.includeArchived} onCheckedChange={(c) => setFilter({ includeArchived: !!c })} />
              Inclure les projets archivés
            </Label>
            {!isDefault(filters) && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Effacer les filtres
              </Button>
            )}
          </PopoverContent>
        </Popover>
        <Select value={filters.sort} onValueChange={(v) => setFilter({ sort: v as ProjectSort })}>
          <SelectTrigger className="w-auto" size="sm" aria-label="Trier">
            <ArrowDownUp className="size-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Ordre manuel</SelectItem>
            <SelectItem value="name">Nom</SelectItem>
            <SelectItem value="deadline">Échéance</SelectItem>
            <SelectItem value="priority">Priorité</SelectItem>
            <SelectItem value="progress">Progression</SelectItem>
            <SelectItem value="updated">Dernière modification</SelectItem>
          </SelectContent>
        </Select>
        <SavedViewsMenu<ProjectFilters> scope="projects" current={filters} onApply={(f) => setFilters({ ...DEFAULT_FILTERS, ...f })} builtins={BUILTIN_VIEWS} />
        <ToggleGroup type="single" variant="outline" size="sm" value={compact ? "compact" : "detailed"} onValueChange={changeDensity} aria-label="Affichage de la liste">
          <ToggleGroupItem value="compact" aria-label="Affichage compact" title="Affichage compact">
            <List className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="detailed" aria-label="Affichage détaillé" title="Affichage détaillé">
            <LayoutList className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filtering ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Résultats</h2>
            <Badge variant="secondary">{filtered.length}</Badge>
          </div>
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Aucun projet ne correspond</p>
          ) : (
            <div className={listGap}>{filtered.map(flatCard)}</div>
          )}
        </section>
      ) : (
        <>
          {favorites.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Star className="size-4 fill-warning text-warning" />
                Favoris
              </h2>
              <div className={listGap}>{favorites.map((p) => flatCard(p))}</div>
            </section>
          )}

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Projets actifs</h2>
              <Badge variant="secondary">{activeRoots.length}</Badge>
            </div>

            {activeRoots.length === 0 ? (
              <Card className="cursor-pointer border-2 border-dashed bg-muted/20 transition-colors hover:bg-muted/30" onClick={() => openCreateDialog()}>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <FolderOpen className="mb-2 size-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Aucun projet actif</p>
                  <p className="mt-1 text-xs text-muted-foreground">Crée ton premier projet ou pars d&apos;un modèle</p>
                  <Button className="mt-4" size="sm">
                    <Plus className="size-4" />
                    Créer
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <DndContext sensors={sensors} collisionDetection={sameParentCollision} onDragEnd={onDragEnd}>
                <SortableContext items={activeRoots.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <div className={listGap}>
                    {activeRoots.map((p) => (
                      <SortableProject key={p.id} project={p} depth={0} tree={tree} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </section>

          {archivedRoots.length > 0 && (
            <section className="space-y-2">
              <Button variant="ghost" className="w-full justify-start" onClick={() => setShowArchived(!showArchived)}>
                <Archive className="size-4" />
                Projets archivés ({archivedRoots.length})
                <ChevronRight className={cn("ml-auto size-4 transition-transform", showArchived && "rotate-90")} />
              </Button>
              {showArchived && <div className={listGap}>{archivedRoots.map(flatCard)}</div>}
            </section>
          )}
        </>
      )}
    </div>
  )

  return (
    <>
      {showDetailOnly ? (
        <ProjectDetail
          key={selectedProject.id}
          project={selectedProject}
          onBack={() => setSelectedProjectId(null)}
          onEdit={openEditDialog}
          onCreateChild={openCreateDialog}
          onToggleArchive={toggleArchive}
          onDelete={trashProject}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 @4xl/main:grid-cols-5">
          <div className="@4xl/main:col-span-2">{list}</div>
          {wide && (
            <div className="@4xl/main:col-span-3">
              {selectedProject ? (
                <div className="@4xl/main:sticky @4xl/main:top-0">
                  <ProjectDetail
                    key={selectedProject.id}
                    project={selectedProject}
                    onEdit={openEditDialog}
                    onCreateChild={openCreateDialog}
                    onToggleArchive={toggleArchive}
                    onDelete={trashProject}
                  />
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Lottie src="/animations/utilisees/Hands typing on keyboard.json" transform={keepFirstCycle} transformKey="single-cycle" className="mb-2 h-36 w-64 max-w-full" />
                    <h3 className="mb-2 font-semibold">Sélectionnez un projet</h3>
                    <p className="text-muted-foreground">Cliquez sur un projet pour voir son aperçu, ses tâches, son planning et ses ressources</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90vh] max-w-[92vw] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Modifier le projet" : form.parentId ? "Nouveau sous-projet" : "Nouveau projet"}</DialogTitle>
            <DialogDescription>{editingProject ? "Modifiez les détails de ce projet ou déplacez-le dans un autre" : "Créez un nouveau projet avec des objectifs clairs"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Nom du projet</Label>
              <Input id="title" placeholder="Ex : Refonte du site web" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>Projet parent</Label>
              <ProjectPicker
                value={form.parentId}
                onChange={(parentId) => setForm({ ...form, parentId })}
                noneLabel="Aucun (projet principal)"
                exclude={parentExclusions}
                includeArchived
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>État</Label>
                <Select value={form.status || NO_STATUS} onValueChange={(v) => setForm({ ...form, status: v === NO_STATUS ? null : (v as ProjectStatus) })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_STATUS}>Aucun état</SelectItem>
                    {PROJECT_STATUSES.map(({ value, label, icon: Icon, className }) => (
                      <SelectItem key={value} value={value}>
                        <Icon className={cn("size-4", className)} />
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <Select value={form.priority || NO_PRIORITY} onValueChange={(v) => setForm({ ...form, priority: v === NO_PRIORITY ? null : (v as Priority) })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PRIORITY}>Aucune</SelectItem>
                    {PRIORITIES.map(({ value, label, className }) => (
                      <SelectItem key={value} value={value}>
                        <Flag className={cn("size-4", className)} />
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Début</Label>
                <Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deadline">Échéance</Label>
                <Input id="deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">Catégorie</Label>
              <Input id="category" list="project-categories" placeholder="Ex : Perso, Travail, Client…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <datalist id="project-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Décrivez votre projet…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="Contexte, décisions, idées…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label>Liens</Label>
              <p className="text-xs text-muted-foreground">Dossier du projet (C:\…), app en ligne, documentation, dépôt…</p>
              <ResourceLinks links={form.links} onChange={(links) => setForm({ ...form, links })} />
            </div>

            <div className="space-y-1.5">
              <Label>Objectifs</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ajouter un objectif"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newObjective.trim()) {
                      e.preventDefault()
                      setForm({ ...form, objectives: [...form.objectives, newObjective.trim()] })
                      setNewObjective("")
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!newObjective.trim()}
                  onClick={() => {
                    setForm({ ...form, objectives: [...form.objectives, newObjective.trim()] })
                    setNewObjective("")
                  }}
                  aria-label="Ajouter l'objectif"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {form.objectives.length > 0 && (
                <ul className="space-y-1.5">
                  {form.objectives.map((obj, index) => (
                    <li key={index} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                      <span className="flex items-center gap-2 text-sm">
                        <Target className="size-4 shrink-0 text-primary" />
                        {obj}
                      </span>
                      <Button variant="ghost" size="icon" className="size-6" onClick={() => setForm({ ...form, objectives: form.objectives.filter((_, i) => i !== index) })} aria-label={`Retirer ${obj}`}>
                        <Trash2 className="size-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!editingProject && (
              <div className="space-y-1.5">
                <Label>Tâches</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ajouter une tâche"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTask.trim()) {
                        e.preventDefault()
                        setForm({ ...form, tasks: [...form.tasks, newTask.trim()] })
                        setNewTask("")
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!newTask.trim()}
                    onClick={() => {
                      setForm({ ...form, tasks: [...form.tasks, newTask.trim()] })
                      setNewTask("")
                    }}
                    aria-label="Ajouter la tâche"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                {form.tasks.length > 0 && (
                  <ul className="space-y-1.5">
                    {form.tasks.map((task, index) => (
                      <li key={index} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                        <span className="text-sm">{task}</span>
                        <Button variant="ghost" size="icon" className="size-6" onClick={() => setForm({ ...form, tasks: form.tasks.filter((_, i) => i !== index) })} aria-label={`Retirer ${task}`}>
                          <Trash2 className="size-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!form.title.trim()}>
              {editingProject ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaveAsTemplateDialog open={!!templateFor} onOpenChange={(o) => !o && setTemplateFor(null)} projectId={templateFor || undefined} />
      {folderFor && <LinkFolderDialog project={folderFor} open onOpenChange={(o) => !o && setFolderFor(null)} />}
    </>
  )
}
