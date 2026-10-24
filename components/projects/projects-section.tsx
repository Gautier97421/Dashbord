"use client"

import { useEffect, useRef, useState } from "react"
import {
  BellRing,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  ListTodo,
  Plus,
  Search,
  SquareKanban,
  Trash2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import * as api from "@/lib/api"
import { useApp } from "@/lib/store-api"
import { cn } from "@/lib/utils"
import { toDay } from "@/lib/projects/core"
import { PRIORITIES, RECURRENCES, taskStatusMeta } from "@/lib/projects/meta"
import { onProjectsTarget, takeProjectsTarget, takeTargetFromUrl, type ProjectsTarget, type ProjectsView } from "@/lib/projects/nav"
import { NotificationSettings } from "@/components/settings/notifications-card"
import { SegmentedTabs } from "@/components/segmented-tabs"
import { ProjectsUIProvider, projectPath, useProjectsUI } from "./context"
import { OverviewView } from "./overview-view"
import { ProjectsBrowser } from "./projects-browser"
import { MyTasksView } from "./my-tasks-view"
import { KanbanView } from "./kanban-view"
import { PlanningView } from "./planning-view"
import { TemplatesView } from "./templates-view"
import { TaskSheet } from "./task-sheet"
import { SearchPalette } from "./search-palette"
import { TrashDialog } from "./trash-dialog"
import { QuickAddTaskDialog } from "./quick-add-task"
import { MoreDots } from "@/components/lottie"

const VIEWS: { value: ProjectsView; label: string; icon: typeof LayoutDashboard }[] = [
  { value: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { value: "projects", label: "Projets", icon: FolderKanban },
  { value: "tasks", label: "Mes tâches", icon: ListTodo },
  { value: "kanban", label: "Kanban", icon: SquareKanban },
  { value: "calendar", label: "Calendrier", icon: CalendarDays },
  { value: "templates", label: "Modèles", icon: LayoutTemplate },
]

export function ProjectsSection() {
  return (
    <ProjectsUIProvider>
      <Section />
    </ProjectsUIProvider>
  )
}

function Section() {
  const { refresh } = useApp()
  const ui = useProjectsUI()
  const { view, setView, openProject, openTask, tasks, today, alerts, projectById } = ui
  const { toast } = useToast()
  const [searchOpen, setSearchOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [createRequest, setCreateRequest] = useState(0)
  const importRef = useRef<HTMLInputElement>(null)

  // Ouverture demandée par une notification (cloche ou push) ou un raccourci de l'app installée
  useEffect(() => {
    const apply = (target: ProjectsTarget | null) => {
      if (!target) return
      if (target.projectId) openProject(target.projectId)
      else if (target.view) setView(target.view)
      if (target.taskId) openTask(target.taskId)
    }
    apply(takeTargetFromUrl() || takeProjectsTarget())
    return onProjectsTarget(() => apply(takeProjectsTarget()))
  }, [openProject, openTask, setView])

  // Ctrl/Cmd + K : recherche globale
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const dueNow = tasks.filter((t) => t.status !== "done" && toDay(t.dueDate) && toDay(t.dueDate)! <= today).length
  const urgentAlerts = alerts.filter((a) => a.severity === "high").length

  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const header = ["Titre", "Projet", "Statut", "Priorité", "Début", "Échéance", "Terminée le", "Répétition", "Sous-tâches", "Description"]
    const rows = tasks.map((t) => [
      t.title,
      projectPath(t.projectId, projectById) || "",
      taskStatusMeta(t.status).label,
      PRIORITIES.find((p) => p.value === t.priority)?.label || t.priority,
      t.startDate || "",
      t.dueDate || "",
      t.completedAt?.slice(0, 10) || "",
      RECURRENCES.find((r) => r.value === t.recurrence)?.label || "",
      (t.checklist || []).map((i) => `${i.done ? "[x]" : "[ ]"} ${i.text}`).join(" | "),
      t.description || "",
    ])
    // Point-virgule et BOM : ouverture directe dans Excel en français
    const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `dashlife-taches-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      const result = await api.projectsApi.import(data)
      await refresh()
      toast({
        title: "Import terminé",
        description: `${result.projects} projet${result.projects > 1 ? "s" : ""}, ${result.tasks} tâche${result.tasks > 1 ? "s" : ""}${result.templates ? `, ${result.templates} modèle${result.templates > 1 ? "s" : ""}` : ""}`,
      })
    } catch (error: any) {
      toast({ title: "Import impossible", description: error?.message || "Le fichier n'est pas un export de projets valide.", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Projets</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">Projets, sous-projets, tâches et planning au même endroit</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)} className="text-muted-foreground">
          <Search className="size-4" />
          <span className="hidden sm:inline">Rechercher</span>
          <kbd className="ml-1 hidden rounded border bg-muted px-1 text-[10px] lg:inline">Ctrl K</kbd>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
          <ListTodo className="size-4" />
          <span className="hidden sm:inline">Tâche</span>
        </Button>
        <Button
          data-tour="projects-add"
          size="sm"
          onClick={() => {
            setView("projects")
            setCreateRequest((n) => n + 1)
          }}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nouveau projet</span>
          <span className="sm:hidden">Projet</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 hover:bg-transparent hover:text-foreground dark:hover:bg-transparent" aria-label="Plus d'actions">
              <MoreDots />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setNotifOpen(true)}>
              <BellRing className="size-4" />
              Notifications…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTrashOpen(true)}>
              <Trash2 className="size-4" />
              Corbeille
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/api/projects/export" download>
                <Download className="size-4" />
                Exporter (JSON)
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportCsv}>
              <FileSpreadsheet className="size-4" />
              Exporter les tâches (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => importRef.current?.click()}>
              <Upload className="size-4" />
              Importer un export…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importFile(file)
            e.target.value = ""
          }}
        />
      </div>

      {/* Onglets de la section (style du choix Matinale / Du soir) : défilent si besoin, collés en haut au défilement */}
      <nav aria-label="Vues des projets" className="sticky top-0 z-20 -mx-2 bg-background/95 px-2 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
        <SegmentedTabs
          label="Vues des projets"
          value={view}
          onChange={setView}
          tabs={VIEWS.map(({ value, label, icon }) => ({
            value,
            label,
            icon,
            badge: value === "tasks" ? dueNow : value === "overview" ? urgentAlerts : 0,
            badgeTone: "alert" as const,
          }))}
        />
      </nav>

      {view === "overview" && <OverviewView />}
      {view === "projects" && <ProjectsBrowser createRequest={createRequest} onCreateHandled={() => setCreateRequest(0)} />}
      {view === "tasks" && <MyTasksView />}
      {view === "kanban" && <KanbanView />}
      {view === "calendar" && <PlanningView />}
      {view === "templates" && <TemplatesView />}

      <TaskSheet />
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <TrashDialog open={trashOpen} onOpenChange={setTrashOpen} />
      <QuickAddTaskDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} onCreated={(id) => openTask(id)} />
      <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
        <DialogContent className="max-h-[85vh] max-w-[94vw] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>Alertes des projets et des tâches, sur cet appareil et dans la cloche.</DialogDescription>
          </DialogHeader>
          <NotificationSettings />
        </DialogContent>
      </Dialog>
    </div>
  )
}
