"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useApp } from "@/lib/store-api"
import { computeAlerts, dayKey, isProjectSectionTask, type ProjectAlert } from "@/lib/projects/core"
import { PROJECTS_VIEWS, type ProjectsView } from "@/lib/projects/nav"
import type { Project, Task } from "@/lib/types"

const VIEW_KEY = "dashlife:projectsView"
const TASK_DENSITY_KEY = "dashlife:tasksDensity"

interface ProjectsUI {
  view: ProjectsView
  setView: (view: ProjectsView) => void
  selectedProjectId: string | null
  setSelectedProjectId: (id: string | null) => void
  // Ouvre la vue "Projets" sur ce projet
  openProject: (id: string) => void
  openTaskId: string | null
  openTask: (id: string | null) => void
  // Jour courant (AAAA-MM-JJ), mis à jour à minuit
  today: string
  // Tâches de la section (sans celles des missions)
  tasks: Task[]
  projectById: Map<string, Project>
  alerts: ProjectAlert[]
  alertsByTask: Map<string, ProjectAlert[]>
  alertsByProject: Map<string, ProjectAlert[]>
  // Tâches du projet et de ses sous-projets
  projectStats: Map<string, ProjectStats>
  // Affichage compact des listes de tâches
  compactTasks: boolean
  setCompactTasks: (compact: boolean) => void
}

export interface ProjectStats {
  total: number
  done: number
  // 0-100, null sans tâche (une progression de 0/0 ne veut rien dire)
  progress: number | null
}

const ProjectsUIContext = createContext<ProjectsUI | null>(null)

export function useProjectsUI() {
  const ctx = useContext(ProjectsUIContext)
  if (!ctx) throw new Error("useProjectsUI must be used within ProjectsUIProvider")
  return ctx
}

const readStored = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export function ProjectsUIProvider({ children }: { children: ReactNode }) {
  const { state } = useApp()
  const [view, setViewState] = useState<ProjectsView>("overview")
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [today, setToday] = useState(() => dayKey())
  const [compactTasks, setCompactTasksState] = useState(true)

  // Préférences lues après le montage : localStorage n'existe pas pendant le rendu serveur
  useEffect(() => {
    const stored = readStored(VIEW_KEY)
    if (stored && PROJECTS_VIEWS.includes(stored as ProjectsView)) setViewState(stored as ProjectsView)
    const density = readStored(TASK_DENSITY_KEY)
    if (density) setCompactTasksState(density !== "detailed")
  }, [])

  // Passage à minuit : les retards et échéances "aujourd'hui" changent
  useEffect(() => {
    const timer = setInterval(() => setToday((prev) => (prev === dayKey() ? prev : dayKey())), 60_000)
    return () => clearInterval(timer)
  }, [])

  const setView = useCallback((next: ProjectsView) => {
    setViewState(next)
    writeStored(VIEW_KEY, next)
  }, [])

  const openProject = useCallback(
    (id: string) => {
      setSelectedProjectId(id)
      setView("projects")
    },
    [setView]
  )

  const setCompactTasks = useCallback((compact: boolean) => {
    setCompactTasksState(compact)
    writeStored(TASK_DENSITY_KEY, compact ? "compact" : "detailed")
  }, [])

  const tasks = useMemo(() => state.tasks.filter(isProjectSectionTask), [state.tasks])
  const projectById = useMemo(() => new Map(state.projects.map((p) => [p.id, p])), [state.projects])
  const alerts = useMemo(() => computeAlerts({ projects: state.projects, tasks, today }), [state.projects, tasks, today])

  const { alertsByTask, alertsByProject } = useMemo(() => {
    const byTask = new Map<string, ProjectAlert[]>()
    const byProject = new Map<string, ProjectAlert[]>()
    for (const a of alerts) {
      if (a.taskId) byTask.set(a.taskId, [...(byTask.get(a.taskId) || []), a])
      else if (a.projectId) byProject.set(a.projectId, [...(byProject.get(a.projectId) || []), a])
    }
    return { alertsByTask: byTask, alertsByProject: byProject }
  }, [alerts])

  const projectStats = useMemo(() => {
    const own = new Map<string, { total: number; done: number }>()
    for (const t of tasks) {
      if (!t.projectId) continue
      const s = own.get(t.projectId) || { total: 0, done: 0 }
      s.total++
      if (t.status === "done") s.done++
      own.set(t.projectId, s)
    }
    const children = new Map<string, string[]>()
    for (const p of state.projects) if (p.parentId) children.set(p.parentId, [...(children.get(p.parentId) || []), p.id])
    const stats = new Map<string, ProjectStats>()
    const compute = (id: string, seen: Set<string>): ProjectStats => {
      const cached = stats.get(id)
      if (cached) return cached
      let { total, done } = own.get(id) || { total: 0, done: 0 }
      seen.add(id)
      for (const child of children.get(id) || []) {
        if (seen.has(child)) continue
        const c = compute(child, seen)
        total += c.total
        done += c.done
      }
      const result = { total, done, progress: total ? Math.round((done / total) * 100) : null }
      stats.set(id, result)
      return result
    }
    for (const p of state.projects) compute(p.id, new Set())
    return stats
  }, [tasks, state.projects])

  const value: ProjectsUI = {
    projectStats,
    view,
    setView,
    selectedProjectId,
    setSelectedProjectId,
    openProject,
    openTaskId,
    openTask: setOpenTaskId,
    today,
    tasks,
    projectById,
    alerts,
    alertsByTask,
    alertsByProject,
    compactTasks,
    setCompactTasks,
  }

  return <ProjectsUIContext.Provider value={value}>{children}</ProjectsUIContext.Provider>
}

/** Projets dans l'ordre de l'arborescence, avec leur profondeur (listes de choix d'un projet). */
export function buildProjectOptions(projects: Project[], exclude?: Set<string>): { project: Project; depth: number }[] {
  const ids = new Set(projects.map((p) => p.id))
  const children = new Map<string | null, Project[]>()
  for (const p of projects) {
    const key = p.parentId && ids.has(p.parentId) ? p.parentId : null
    children.set(key, [...(children.get(key) || []), p])
  }
  const options: { project: Project; depth: number }[] = []
  const walk = (parentId: string | null, depth: number) => {
    const list = [...(children.get(parentId) || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    for (const p of list) {
      if (exclude?.has(p.id)) continue
      options.push({ project: p, depth })
      walk(p.id, depth + 1)
    }
  }
  walk(null, 0)
  return options
}

/** "Parent › Sous-projet" pour situer une tâche ou un projet imbriqué. */
export function projectPath(projectId: string | undefined | null, projectById: Map<string, Project>): string | null {
  if (!projectId) return null
  const names: string[] = []
  const seen = new Set<string>()
  let cur = projectById.get(projectId)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    names.unshift(cur.title)
    cur = cur.parentId ? projectById.get(cur.parentId) : undefined
  }
  return names.length ? names.join(" › ") : null
}
