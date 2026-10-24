"use client"

// Ouvrir un projet, une tâche ou une vue de la section Projets depuis ailleurs : notification de la
// cloche, notification push (adresse "/?page=projects&task=…"), raccourci de l'app installée.

export type ProjectsView = "overview" | "projects" | "tasks" | "kanban" | "calendar" | "templates"

export const PROJECTS_VIEWS: ProjectsView[] = ["overview", "projects", "tasks", "kanban", "calendar", "templates"]

export interface ProjectsTarget {
  view?: ProjectsView
  projectId?: string
  taskId?: string
}

const EVENT = "dashlife:projects-target"
let pending: ProjectsTarget | null = null

/** À appeler avant de naviguer vers la page "projects" : la section l'ouvrira au montage ou tout de suite. */
export function requestProjectsTarget(target: ProjectsTarget) {
  pending = target
  window.dispatchEvent(new Event(EVENT))
}

export function takeProjectsTarget(): ProjectsTarget | null {
  const target = pending
  pending = null
  return target
}

export function onProjectsTarget(listener: () => void) {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

/** Cible passée dans l'adresse (clic sur une notification push) ; les paramètres sont retirés de l'adresse. */
export function takeTargetFromUrl(): ProjectsTarget | null {
  const params = new URLSearchParams(window.location.search)
  const view = params.get("view")
  const target: ProjectsTarget = {
    view: PROJECTS_VIEWS.includes(view as ProjectsView) ? (view as ProjectsView) : undefined,
    projectId: params.get("project") || undefined,
    taskId: params.get("task") || undefined,
  }
  if (!target.view && !target.projectId && !target.taskId) return null
  for (const key of ["view", "project", "task"]) params.delete(key)
  const query = params.toString()
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
  return target
}
