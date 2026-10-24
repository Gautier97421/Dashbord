// Création d'une arborescence de projets à partir d'un modèle, et l'inverse (photo d'un projet existant).
// Sert aux modèles, à la duplication et à l'import.

import { prisma } from "@/lib/prisma"
import { addDays, daysBetween, toDay } from "@/lib/projects/core"
import { logActivity, parsePriority, parseProjectStatus, parseRecurrence, sanitizeLinks } from "@/lib/projects/server"
import type { ProjectTemplateData, TemplateNode, TemplateTask } from "@/lib/project-templates"

const MAX_NODES = 200
const MAX_TASKS = 2000

/** Crée le projet décrit par le modèle ; renvoie l'id du projet principal. */
export async function instantiateTemplate(
  userId: string,
  data: ProjectTemplateData,
  opts: { title?: string; startDate: string; parentId?: string | null; source?: string }
): Promise<string> {
  const start = opts.startDate
  const at = (offset?: number) => (typeof offset === "number" ? addDays(start, Math.round(offset)) : null)
  const taskIdByRef = new Map<string, string>()
  const pendingDeps: { taskId: string; refs: string[] }[] = []
  let nodes = 0
  let tasks = 0

  const createNode = async (node: TemplateNode, parentId: string | null, order: number, isRoot: boolean): Promise<string> => {
    if (++nodes > MAX_NODES) throw new Error("Template too large")
    const deadline = at(node.deadlineOffsetDays)
    const project = await prisma.project.create({
      data: {
        userId,
        title: (isRoot && opts.title?.trim() ? opts.title.trim() : node.title || "Projet").slice(0, 300),
        description: node.description?.slice(0, 5000) || null,
        notes: node.notes?.slice(0, 20000) || null,
        objectives: (node.objectives || []).filter((o) => typeof o === "string").slice(0, 50),
        category: node.category?.slice(0, 50) || null,
        priority: parsePriority(node.priority) || null,
        status: parseProjectStatus(node.status) || null,
        startDate: at(node.startOffsetDays ?? (isRoot ? 0 : undefined)),
        deadline: deadline ? new Date(deadline).toISOString() : null,
        links: sanitizeLinks(node.links) ?? [],
        parentId,
        order,
      },
    })

    let taskOrder = 0
    for (const t of node.tasks || []) {
      if (++tasks > MAX_TASKS) throw new Error("Template too large")
      const created = await prisma.task.create({
        data: {
          userId,
          projectId: project.id,
          title: (t.title || "Tâche").slice(0, 500),
          description: t.description?.slice(0, 5000) || null,
          notes: t.notes?.slice(0, 20000) || null,
          priority: parsePriority(t.priority) || "medium",
          status: "todo",
          dueDate: at(t.offsetDays),
          startDate: at(t.startOffsetDays),
          checklist: (t.checklist || []).slice(0, 100).map((text, i) => ({ id: `c${i}-${Math.random().toString(36).slice(2, 8)}`, text: String(text).slice(0, 500), done: false })),
          links: sanitizeLinks(t.links) ?? [],
          recurrence: parseRecurrence(t.recurrence) || null,
          order: taskOrder++,
        },
      })
      if (t.ref) taskIdByRef.set(t.ref, created.id)
      if (t.dependsOn?.length) pendingDeps.push({ taskId: created.id, refs: t.dependsOn })
    }

    let childOrder = 0
    for (const child of node.children || []) await createNode(child, project.id, childOrder++, false)
    return project.id
  }

  const last = await prisma.project.aggregate({ where: { userId, parentId: opts.parentId || null }, _max: { order: true } })
  const rootId = await createNode(data.root, opts.parentId || null, (last._max.order ?? 0) + 1, true)

  for (const { taskId, refs } of pendingDeps) {
    const ids = refs.map((r) => taskIdByRef.get(r)).filter((id): id is string => !!id)
    if (ids.length) await prisma.task.update({ where: { id: taskId }, data: { dependsOn: ids } })
  }

  await logActivity(userId, [{ projectId: rootId, message: opts.source ? `Projet créé depuis ${opts.source}` : "Projet créé" }])
  return rootId
}

/** Photo d'un projet existant (sous-projets et tâches) sous forme de modèle, progression remise à zéro. */
export async function snapshotProject(userId: string, projectId: string): Promise<{ data: ProjectTemplateData; baseDay: string } | null> {
  const projects = await prisma.project.findMany({ where: { userId, deletedAt: null } })
  const root = projects.find((p) => p.id === projectId)
  if (!root) return null
  const tasks = await prisma.task.findMany({ where: { userId, deletedAt: null, projectId: { not: null } }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] })

  const baseDay = toDay(root.startDate) || root.createdAt.toISOString().slice(0, 10)
  const offset = (value?: string | null) => {
    const day = toDay(value)
    return day ? daysBetween(baseDay, day) : undefined
  }

  const build = (p: (typeof projects)[number]): TemplateNode => ({
    title: p.title,
    description: p.description || undefined,
    notes: p.notes || undefined,
    category: p.category || undefined,
    priority: p.priority || undefined,
    // Un projet commencé ou fini repart de zéro
    status: p.status ? "not_started" : null,
    startOffsetDays: offset(p.startDate),
    deadlineOffsetDays: offset(p.deadline),
    objectives: p.objectives,
    links: Array.isArray(p.links) ? (p.links as any) : [],
    tasks: tasks
      .filter((t) => t.projectId === p.id)
      .map(
        (t): TemplateTask => ({
          ref: t.id,
          title: t.title,
          description: t.description || undefined,
          notes: t.notes || undefined,
          priority: t.priority,
          offsetDays: offset(t.dueDate),
          startOffsetDays: offset(t.startDate),
          checklist: Array.isArray(t.checklist) ? (t.checklist as any[]).map((i) => String(i?.text ?? "")).filter(Boolean) : [],
          recurrence: t.recurrence || undefined,
          dependsOn: t.dependsOn,
          links: Array.isArray(t.links) ? (t.links as any) : [],
        })
      ),
    children: projects.filter((c) => c.parentId === p.id).sort((a, b) => a.order - b.order).map(build),
  })

  return { data: { root: build(root) }, baseDay }
}

/** Validation minimale d'un modèle reçu du client (import ou modèle enregistré). */
export function isTemplateData(input: unknown): input is ProjectTemplateData {
  const root = (input as ProjectTemplateData)?.root
  return !!root && typeof root === "object" && typeof root.title === "string"
}
