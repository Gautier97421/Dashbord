// Logique des projets partagée entre le navigateur et le serveur (alertes, dates, récurrence).
// Aucune dépendance à React ni à Prisma : les deux côtés calculent exactement les mêmes alertes.

import type { Priority, ProjectStatus, Recurrence, TaskStatus } from "@/lib/types"

const DAY_MS = 86_400_000

// ─── Jours "YYYY-MM-DD" ──────────────────────────────────────────────────────
// Les échéances sont des jours, pas des instants : on compare des chaînes AAAA-MM-JJ, sans fuseau.

/** Jour courant, dans le fuseau du navigateur ou dans `timeZone` (côté serveur). */
export function dayKey(date = new Date(), timeZone?: string): string {
  if (timeZone) {
    try {
      // en-CA formate en AAAA-MM-JJ
      return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
    } catch {
      /* fuseau inconnu : heure du serveur */
    }
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Heure locale (0-23) dans un fuseau donné. */
export function hourIn(timeZone: string, date = new Date()): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(date))
  } catch {
    return date.getHours()
  }
}

/** Ramène une date stockée (AAAA-MM-JJ ou ISO complet) à son jour, ou undefined. */
export function toDay(value?: string | null): string | undefined {
  if (!value) return undefined
  const day = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined
}

function utc(day: string): number {
  const [y, m, d] = day.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(day: string, n: number): string {
  return new Date(utc(day) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY_MS)
}

/** 0 = lundi … 6 = dimanche */
export function weekdayIndex(day: string): number {
  return (new Date(utc(day)).getUTCDay() + 6) % 7
}

export function startOfWeek(day: string): string {
  return addDays(day, -weekdayIndex(day))
}

export function endOfWeek(day: string): string {
  return addDays(startOfWeek(day), 6)
}

export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number)
  const target = new Date(Date.UTC(y, m - 1 + n, 1))
  // 31 janvier + 1 mois = 28 (ou 29) février
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/** Jour au format court lisible : "12 oct." */
export function formatDay(day: string, withYear = false): string {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  })
}

/** "aujourd'hui", "demain", "hier", "dans 3 j", "il y a 2 j", ou la date. */
export function relativeDay(day: string, today: string): string {
  const diff = daysBetween(today, day)
  if (diff === 0) return "aujourd'hui"
  if (diff === 1) return "demain"
  if (diff === -1) return "hier"
  if (diff > 1 && diff <= 6) return `dans ${diff} j`
  if (diff < -1 && diff >= -30) return `il y a ${-diff} j`
  return formatDay(day, Math.abs(diff) > 300)
}

// ─── Récurrence ──────────────────────────────────────────────────────────────

export function nextOccurrence(day: string, recurrence: Recurrence): string {
  if (recurrence === "daily") return addDays(day, 1)
  if (recurrence === "weekly") return addDays(day, 7)
  return addMonths(day, 1)
}

// ─── Priorités ───────────────────────────────────────────────────────────────

export const PRIORITY_RANK: Record<Priority, number> = { urgent: 3, high: 2, medium: 1, low: 0 }

export const isHighPriority = (p?: Priority | null) => p === "high" || p === "urgent"

// ─── Alertes ─────────────────────────────────────────────────────────────────

export type AlertKind =
  | "task_overdue"
  | "task_due_soon"
  | "task_blocked"
  | "task_blocking"
  | "project_overdue"
  | "project_due_soon"
  | "project_stale"
  | "project_should_start"

export const ALERT_KINDS: { kind: AlertKind; label: string; description: string }[] = [
  { kind: "task_overdue", label: "Tâche en retard", description: "Une tâche dépasse son échéance" },
  { kind: "task_due_soon", label: "Tâche à faire bientôt", description: "Échéance aujourd'hui ou demain" },
  { kind: "task_blocked", label: "Tâche bloquée", description: "Elle dépend d'une tâche encore en cours" },
  { kind: "task_blocking", label: "Tâche bloquante", description: "D'autres tâches attendent qu'elle soit terminée" },
  { kind: "project_overdue", label: "Projet en retard", description: "L'échéance du projet est dépassée" },
  { kind: "project_due_soon", label: "Échéance de projet proche", description: "Dans les 3 prochains jours" },
  { kind: "project_stale", label: "Projet à l'arrêt", description: "Aucune modification depuis 14 jours" },
  { kind: "project_should_start", label: "Projet à démarrer", description: "La date de début est passée mais le projet n'a pas commencé" },
]

export interface AlertTask {
  id: string
  title: string
  status: TaskStatus
  dueDate?: string | null
  projectId?: string | null
  missionId?: string | null
  dependsOn?: string[] | null
  updatedAt?: string | Date | null
  createdAt?: string | Date | null
}

export interface AlertProject {
  id: string
  title: string
  status?: ProjectStatus | null
  deadline?: string | null
  startDate?: string | null
  completedAt?: string | null
  parentId?: string | null
  updatedAt?: string | Date | null
  createdAt?: string | Date | null
}

export interface ProjectAlert {
  kind: AlertKind
  severity: "high" | "medium" | "low"
  title: string
  body: string
  projectId?: string
  taskId?: string
  // Clé de dédoublonnage des notifications : une alerte n'est envoyée qu'une fois par situation
  dedupeKey: string
  // Faux pour les alertes seulement visuelles (ex. tâche bloquée sans échéance proche)
  notify: boolean
}

export const STALE_DAYS = 14
const DUE_SOON_PROJECT_DAYS = 3
const BLOCKING_HORIZON_DAYS = 3

const toDayOf = (value?: string | Date | null) =>
  value ? (typeof value === "string" ? toDay(value) : value.toISOString().slice(0, 10)) : undefined

/** Les tâches des missions vivent dans la page Missions : la section Projets les ignore. */
export const isProjectSectionTask = (t: { missionId?: string | null }) => !t.missionId

export function computeAlerts(input: {
  projects: AlertProject[]
  tasks: AlertTask[]
  today: string
}): ProjectAlert[] {
  const { today } = input
  const tasks = input.tasks.filter(isProjectSectionTask)
  const projects = input.projects
  const projectById = new Map(projects.map((p) => [p.id, p]))
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const open = (t: AlertTask) => t.status !== "done"
  const projectName = (id?: string | null) => (id && projectById.get(id)?.title) || null
  const inProject = (t: AlertTask) => (projectName(t.projectId) ? ` · ${projectName(t.projectId)}` : "")
  const alerts: ProjectAlert[] = []

  // Tâches qui attendent chaque tâche (dépendances encore ouvertes uniquement)
  const dependents = new Map<string, AlertTask[]>()
  for (const t of tasks) {
    if (!open(t)) continue
    for (const depId of t.dependsOn || []) {
      const dep = taskById.get(depId)
      if (dep && open(dep)) dependents.set(depId, [...(dependents.get(depId) || []), t])
    }
  }

  for (const t of tasks) {
    if (!open(t)) continue
    const due = toDay(t.dueDate)
    const diff = due ? daysBetween(today, due) : undefined

    if (due && diff! < 0) {
      alerts.push({
        kind: "task_overdue",
        severity: "high",
        title: `En retard : ${t.title}`,
        body: `Échéance dépassée depuis ${-diff!} jour${diff! < -1 ? "s" : ""}${inProject(t)}`,
        projectId: t.projectId || undefined,
        taskId: t.id,
        dedupeKey: `task_overdue:${t.id}:${due}`,
        notify: true,
      })
    } else if (due && diff! <= 1) {
      alerts.push({
        kind: "task_due_soon",
        severity: "medium",
        title: `${diff === 0 ? "Aujourd'hui" : "Demain"} : ${t.title}`,
        body: `À terminer ${diff === 0 ? "aujourd'hui" : "demain"}${inProject(t)}`,
        projectId: t.projectId || undefined,
        taskId: t.id,
        dedupeKey: `task_due_soon:${t.id}:${due}`,
        notify: true,
      })
    }

    const blockers = (t.dependsOn || []).map((id) => taskById.get(id)).filter((d): d is AlertTask => !!d && open(d))
    if (blockers.length) {
      alerts.push({
        kind: "task_blocked",
        severity: "medium",
        title: `Bloquée : ${t.title}`,
        body: `Attend ${blockers.map((b) => `« ${b.title} »`).join(", ")}`,
        projectId: t.projectId || undefined,
        taskId: t.id,
        dedupeKey: `task_blocked:${t.id}:${due || "none"}`,
        // Notifier seulement quand le blocage devient urgent
        notify: diff !== undefined && diff <= BLOCKING_HORIZON_DAYS,
      })
    }

    const waiting = dependents.get(t.id) || []
    if (waiting.length) {
      const urgentDues = waiting
        .map((w) => toDay(w.dueDate))
        .filter((d): d is string => !!d && daysBetween(today, d) <= BLOCKING_HORIZON_DAYS)
        .sort()
      alerts.push({
        kind: "task_blocking",
        severity: urgentDues.length ? "high" : "low",
        title: `Bloquante : ${t.title}`,
        body: `${waiting.length} tâche${waiting.length > 1 ? "s attendent" : " attend"} qu'elle soit terminée${inProject(t)}`,
        projectId: t.projectId || undefined,
        taskId: t.id,
        dedupeKey: `task_blocking:${t.id}:${urgentDues[0] || "none"}`,
        notify: urgentDues.length > 0,
      })
    }
  }

  // Dernière activité de chaque projet, sous-projets et tâches compris
  const childrenOf = new Map<string, string[]>()
  for (const p of projects) {
    if (p.parentId && projectById.has(p.parentId)) childrenOf.set(p.parentId, [...(childrenOf.get(p.parentId) || []), p.id])
  }
  const tasksByProject = new Map<string, AlertTask[]>()
  for (const t of tasks) {
    if (t.projectId) tasksByProject.set(t.projectId, [...(tasksByProject.get(t.projectId) || []), t])
  }
  const lastActivity = (id: string, seen = new Set<string>()): string | undefined => {
    if (seen.has(id)) return undefined
    seen.add(id)
    const p = projectById.get(id)
    const days = [
      toDayOf(p?.updatedAt) || toDayOf(p?.createdAt),
      ...(tasksByProject.get(id) || []).map((t) => toDayOf(t.updatedAt) || toDayOf(t.createdAt)),
      ...(childrenOf.get(id) || []).map((c) => lastActivity(c, seen)),
    ].filter((d): d is string => !!d)
    return days.sort().at(-1)
  }

  for (const p of projects) {
    if (p.completedAt || p.status === "done") continue
    const deadline = toDay(p.deadline)
    const diff = deadline ? daysBetween(today, deadline) : undefined

    if (deadline && diff! < 0) {
      alerts.push({
        kind: "project_overdue",
        severity: "high",
        title: `Projet en retard : ${p.title}`,
        body: `Échéance dépassée depuis ${-diff!} jour${diff! < -1 ? "s" : ""}`,
        projectId: p.id,
        dedupeKey: `project_overdue:${p.id}:${deadline}`,
        notify: true,
      })
    } else if (deadline && diff! <= DUE_SOON_PROJECT_DAYS) {
      alerts.push({
        kind: "project_due_soon",
        severity: "medium",
        title: `Échéance proche : ${p.title}`,
        body: diff === 0 ? "L'échéance est aujourd'hui" : `L'échéance est dans ${diff} jour${diff! > 1 ? "s" : ""}`,
        projectId: p.id,
        dedupeKey: `project_due_soon:${p.id}:${deadline}`,
        notify: true,
      })
    }

    const start = toDay(p.startDate)
    if (p.status === "not_started" && start && start <= today) {
      alerts.push({
        kind: "project_should_start",
        severity: "low",
        title: `À démarrer : ${p.title}`,
        body: start === today ? "Le projet devait commencer aujourd'hui" : `Le projet devait commencer le ${formatDay(start)}`,
        projectId: p.id,
        dedupeKey: `project_should_start:${p.id}:${start}`,
        notify: true,
      })
    }

    const last = lastActivity(p.id)
    if (last && daysBetween(last, today) >= STALE_DAYS) {
      alerts.push({
        kind: "project_stale",
        severity: "low",
        title: `À l'arrêt : ${p.title}`,
        body: `Aucune modification depuis ${daysBetween(last, today)} jours`,
        projectId: p.id,
        dedupeKey: `project_stale:${p.id}:${last}`,
        notify: true,
      })
    }
  }

  const order = { high: 0, medium: 1, low: 2 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

// ─── Arborescence ────────────────────────────────────────────────────────────

/** Ids du projet et de tous ses descendants. */
export function projectTreeIds(projects: { id: string; parentId?: string | null }[], rootId: string): Set<string> {
  const ids = new Set([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const p of projects) {
      if (p.parentId && ids.has(p.parentId) && !ids.has(p.id)) {
        ids.add(p.id)
        grew = true
      }
    }
  }
  return ids
}

/** Vrai si une tâche de `taskId` vers `depIds` créerait une boucle de dépendances. */
export function createsDependencyCycle(
  tasks: { id: string; dependsOn?: string[] | null }[],
  taskId: string,
  depIds: string[]
): boolean {
  const deps = new Map(tasks.map((t) => [t.id, t.dependsOn || []]))
  deps.set(taskId, depIds)
  const stack = [...depIds]
  const seen = new Set<string>()
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === taskId) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    stack.push(...(deps.get(cur) || []))
  }
  return false
}
