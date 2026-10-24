// Outils serveur des routes Projets / Tâches : session, validation des champs, historique, corbeille.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatDay, toDay } from "@/lib/projects/core"
import { removeStoredFiles } from "@/lib/projects/storage"

export async function getSessionUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  return prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, email: true } })
}

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 })
export const notFound = (error = "Not found") => NextResponse.json({ error }, { status: 404 })

type OwnedModel = "mission" | "project" | "workoutProgram" | "recipe"

/**
 * Référence vers une autre donnée (mission, projet…) envoyée par le client : gardée seulement si elle
 * appartient à l'utilisateur. undefined = champ absent (inchangé), null = aucune ou refusée.
 */
export async function ownRef(model: OwnedModel, id: unknown, userId: string): Promise<string | null | undefined> {
  if (id === undefined) return undefined
  if (typeof id !== "string" || !id) return null
  const delegate = prisma[model] as unknown as { findFirst(args: object): Promise<unknown> }
  return (await delegate.findFirst({ where: { id, userId }, select: { id: true } })) ? id : null
}

// ─── Validation ──────────────────────────────────────────────────────────────

const PRIORITIES = ["low", "medium", "high", "urgent"] as const
const TASK_STATUSES = ["todo", "in_progress", "waiting", "done"] as const
const PROJECT_STATUSES = ["not_started", "in_progress", "done"] as const
const RECURRENCES = ["daily", "weekly", "monthly"] as const

const pick = <T extends readonly string[]>(values: T, input: unknown): T[number] | undefined =>
  values.find((v) => v === input)

export const parsePriority = (input: unknown) => pick(PRIORITIES, input)
export const parseTaskStatus = (input: unknown) => pick(TASK_STATUSES, input)
export const parseProjectStatus = (input: unknown) => pick(PROJECT_STATUSES, input)
export const parseRecurrence = (input: unknown) => pick(RECURRENCES, input)

/**
 * Champ optionnel d'une requête de modification : absent → inchangé (undefined),
 * null ou "" → effacé (null), sinon la valeur validée (ou undefined si invalide).
 */
export function nullable<T>(input: unknown, parse: (v: unknown) => T | undefined): T | null | undefined {
  if (input === undefined) return undefined
  if (input === null || input === "") return null
  return parse(input)
}

export const parseDay = (input: unknown) => (typeof input === "string" ? toDay(input) : undefined)

export const parseText = (max: number) => (input: unknown) =>
  typeof input === "string" ? input.slice(0, max) : undefined

const randomId = () => Math.random().toString(36).slice(2, 10)

/** Liens : on ne garde que des { id, label, url } textuels et non vides */
export function sanitizeLinks(input: unknown): { id: string; label: string; url: string }[] | undefined {
  if (!Array.isArray(input)) return undefined
  return input
    .filter((l) => l && typeof l.url === "string" && l.url.trim())
    .slice(0, 20)
    .map((l) => ({
      id: typeof l.id === "string" && l.id ? l.id.slice(0, 64) : randomId(),
      label: (typeof l.label === "string" && l.label.trim() ? l.label : l.url).trim().slice(0, 100),
      url: l.url.trim().slice(0, 2000),
    }))
}

export function sanitizeChecklist(input: unknown): { id: string; text: string; done: boolean }[] | undefined {
  if (!Array.isArray(input)) return undefined
  return input
    .filter((i) => i && typeof i.text === "string" && i.text.trim())
    .slice(0, 100)
    .map((i) => ({
      id: typeof i.id === "string" && i.id ? i.id.slice(0, 64) : randomId(),
      text: i.text.trim().slice(0, 500),
      done: i.done === true,
    }))
}

export function sanitizeIds(input: unknown, max = 50): string[] | undefined {
  if (!Array.isArray(input)) return undefined
  return [...new Set(input.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 64))].slice(0, max)
}

// ─── Historique ──────────────────────────────────────────────────────────────

export async function logActivity(
  userId: string,
  entries: { projectId?: string | null; taskId?: string | null; message: string }[]
) {
  if (!entries.length) return
  try {
    await prisma.projectActivity.createMany({
      data: entries.map((e) => ({
        userId,
        projectId: e.projectId || null,
        taskId: e.taskId || null,
        kind: "event",
        message: e.message.slice(0, 2000),
      })),
    })
  } catch (error) {
    // L'historique ne doit jamais faire échouer la modification elle-même
    console.error("Error logging project activity:", error)
  }
}

export const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  waiting: "En attente",
  done: "Terminé",
}
export const PRIORITY_LABEL: Record<string, string> = { low: "Basse", medium: "Normale", high: "Haute", urgent: "Urgente" }
export const PROJECT_STATUS_LABEL: Record<string, string> = {
  not_started: "Pas commencé",
  in_progress: "En cours",
  done: "Fini",
}

const dayLabel = (v?: string | null) => (toDay(v) ? formatDay(toDay(v)!, true) : "aucune")

/** Messages d'historique décrivant ce qui a changé entre deux versions d'une tâche. */
export function describeTaskChanges(
  before: { title: string; status: string; priority: string; dueDate: string | null; startDate: string | null; projectId: string | null },
  after: { title: string; status: string; priority: string; dueDate: string | null; startDate: string | null; projectId: string | null },
  projectTitles: Map<string, string>
): string[] {
  const name = `« ${after.title} »`
  const changes: string[] = []
  if (before.title !== after.title) changes.push(`Tâche renommée : « ${before.title} » → ${name}`)
  if (before.status !== after.status) {
    changes.push(`${name} : ${TASK_STATUS_LABEL[before.status] || before.status} → ${TASK_STATUS_LABEL[after.status] || after.status}`)
  }
  if (before.priority !== after.priority) {
    changes.push(`${name} : priorité ${PRIORITY_LABEL[before.priority] || before.priority} → ${PRIORITY_LABEL[after.priority] || after.priority}`)
  }
  if ((before.dueDate || null) !== (after.dueDate || null)) {
    changes.push(`${name} : échéance ${dayLabel(before.dueDate)} → ${dayLabel(after.dueDate)}`)
  }
  if ((before.startDate || null) !== (after.startDate || null)) {
    changes.push(`${name} : début ${dayLabel(before.startDate)} → ${dayLabel(after.startDate)}`)
  }
  if ((before.projectId || null) !== (after.projectId || null)) {
    const target = after.projectId ? projectTitles.get(after.projectId) : null
    changes.push(target ? `${name} déplacée vers « ${target} »` : `${name} n'est plus rattachée à un projet`)
  }
  return changes
}

export function describeProjectChanges(
  before: { title: string; status: string | null; deadline: string | null; startDate: string | null; completedAt: string | null; priority: string | null; parentId: string | null },
  after: { title: string; status: string | null; deadline: string | null; startDate: string | null; completedAt: string | null; priority: string | null; parentId: string | null },
  projectTitles: Map<string, string>
): string[] {
  const changes: string[] = []
  if (before.title !== after.title) changes.push(`Projet renommé : « ${before.title} » → « ${after.title} »`)
  if ((before.status || null) !== (after.status || null)) {
    changes.push(`État : ${PROJECT_STATUS_LABEL[before.status || ""] || "aucun"} → ${PROJECT_STATUS_LABEL[after.status || ""] || "aucun"}`)
  }
  if ((before.priority || null) !== (after.priority || null)) {
    changes.push(`Priorité : ${PRIORITY_LABEL[before.priority || ""] || "aucune"} → ${PRIORITY_LABEL[after.priority || ""] || "aucune"}`)
  }
  if (toDay(before.deadline) !== toDay(after.deadline)) changes.push(`Échéance : ${dayLabel(before.deadline)} → ${dayLabel(after.deadline)}`)
  if (toDay(before.startDate) !== toDay(after.startDate)) changes.push(`Début : ${dayLabel(before.startDate)} → ${dayLabel(after.startDate)}`)
  if (!!before.completedAt !== !!after.completedAt) changes.push(after.completedAt ? "Projet archivé" : "Projet réactivé")
  if ((before.parentId || null) !== (after.parentId || null)) {
    const target = after.parentId ? projectTitles.get(after.parentId) : null
    changes.push(target ? `Déplacé dans « ${target} »` : "Devenu un projet principal")
  }
  return changes
}

// ─── Corbeille ───────────────────────────────────────────────────────────────

export const TRASH_RETENTION_DAYS = 30

async function treeIds(userId: string, rootId: string): Promise<string[]> {
  const all = await prisma.project.findMany({ where: { userId }, select: { id: true, parentId: true } })
  const ids = new Set([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const p of all) {
      if (p.parentId && ids.has(p.parentId) && !ids.has(p.id)) {
        ids.add(p.id)
        grew = true
      }
    }
  }
  return [...ids]
}

/** Met un projet, ses sous-projets et toutes leurs tâches à la corbeille, avec la même date. */
export async function trashProjectTree(userId: string, projectId: string) {
  const ids = await treeIds(userId, projectId)
  const deletedAt = new Date()
  await prisma.$transaction([
    prisma.project.updateMany({ where: { userId, id: { in: ids }, deletedAt: null }, data: { deletedAt } }),
    prisma.task.updateMany({ where: { userId, projectId: { in: ids }, deletedAt: null }, data: { deletedAt } }),
  ])
  return ids
}

/** Restaure un projet et tout ce qui a été mis à la corbeille avec lui. */
export async function restoreProjectTree(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { deletedAt: true } })
  if (!project?.deletedAt) return
  const ids = await treeIds(userId, projectId)
  const batch = project.deletedAt
  await prisma.$transaction([
    prisma.project.updateMany({ where: { userId, id: { in: ids }, deletedAt: batch }, data: { deletedAt: null } }),
    prisma.task.updateMany({ where: { userId, projectId: { in: ids }, deletedAt: batch }, data: { deletedAt: null } }),
  ])
}

async function deleteAttachmentsOf(where: { projectId?: { in: string[] }; taskId?: { in: string[] } }) {
  const files = await prisma.attachment.findMany({ where, select: { storageKey: true } })
  await removeStoredFiles(files.map((f) => f.storageKey))
}

/** Retire un id de tâche des dépendances des autres tâches. */
async function dropDependency(userId: string, taskIds: string[]) {
  if (!taskIds.length) return
  const dependents = await prisma.task.findMany({
    where: { userId, dependsOn: { hasSome: taskIds } },
    select: { id: true, dependsOn: true },
  })
  for (const t of dependents) {
    await prisma.task.update({ where: { id: t.id }, data: { dependsOn: t.dependsOn.filter((d) => !taskIds.includes(d)) } })
  }
}

export async function deleteTasksPermanently(userId: string, taskIds: string[]) {
  if (!taskIds.length) return
  await deleteAttachmentsOf({ taskId: { in: taskIds } })
  await prisma.task.deleteMany({ where: { userId, id: { in: taskIds } } })
  await dropDependency(userId, taskIds)
}

/** Suppression définitive d'un projet de la corbeille, avec ses sous-projets et les tâches jetées avec lui. */
export async function deleteProjectPermanently(userId: string, projectId: string) {
  const ids = await treeIds(userId, projectId)
  const tasks = await prisma.task.findMany({
    where: { userId, projectId: { in: ids }, deletedAt: { not: null } },
    select: { id: true },
  })
  await deleteTasksPermanently(userId, tasks.map((t) => t.id))
  await deleteAttachmentsOf({ projectId: { in: ids } })
  // Les sous-projets suivent leur parent (cascade en base)
  await prisma.project.deleteMany({ where: { userId, id: projectId } })
}

/** Vide ce qui est à la corbeille depuis plus de 30 jours (tous les utilisateurs si userId absent). */
export async function purgeExpiredTrash(userId?: string) {
  const limit = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000)
  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({ where: { ...(userId ? { userId } : {}), deletedAt: { lt: limit } }, select: { id: true, userId: true } }),
    prisma.task.findMany({ where: { ...(userId ? { userId } : {}), deletedAt: { lt: limit } }, select: { id: true, userId: true } }),
  ])
  for (const p of projects) {
    // Un sous-projet a pu disparaître avec son parent juste avant
    const still = await prisma.project.findUnique({ where: { id: p.id }, select: { id: true } })
    if (still) await deleteProjectPermanently(p.userId, p.id)
  }
  const remaining = await prisma.task.findMany({ where: { id: { in: tasks.map((t) => t.id) } }, select: { id: true, userId: true } })
  const byUser = new Map<string, string[]>()
  for (const t of remaining) byUser.set(t.userId, [...(byUser.get(t.userId) || []), t.id])
  for (const [uid, ids] of byUser) await deleteTasksPermanently(uid, ids)
}
