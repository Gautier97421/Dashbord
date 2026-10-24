import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createsDependencyCycle, nextOccurrence, toDay } from '@/lib/projects/core'
import {
  badRequest,
  describeTaskChanges,
  getSessionUser,
  logActivity,
  notFound,
  nullable,
  parseDay,
  parsePriority,
  parseRecurrence,
  parseTaskStatus,
  parseText,
  sanitizeChecklist,
  sanitizeIds,
  sanitizeLinks,
  unauthorized,
} from '@/lib/projects/server'

// Projet de destination valide : il appartient à l'utilisateur et n'est pas à la corbeille
async function ownsProject(userId: string, projectId: string) {
  return !!(await prisma.project.findFirst({ where: { id: projectId, userId, deletedAt: null }, select: { id: true } }))
}

// Mission de rattachement valide : elle appartient à l'utilisateur
async function ownsMission(userId: string, missionId: string) {
  return !!(await prisma.mission.findFirst({ where: { id: missionId, userId }, select: { id: true } }))
}

// Dépendances valides : tâches de l'utilisateur, sans la tâche elle-même ni boucle
async function validDependencies(userId: string, taskId: string | null, ids: string[]) {
  const tasks = await prisma.task.findMany({ where: { userId, deletedAt: null }, select: { id: true, dependsOn: true } })
  const known = new Set(tasks.map((t) => t.id))
  const deps = ids.filter((id) => known.has(id) && id !== taskId)
  if (taskId && createsDependencyCycle(tasks, taskId, deps)) return null
  return deps
}

async function projectTitles(userId: string) {
  const projects = await prisma.project.findMany({ where: { userId }, select: { id: true, title: true } })
  return new Map(projects.map((p) => [p.id, p.title]))
}

// GET all tasks (hors corbeille)
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const tasks = await prisma.task.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// POST create a new task
export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 500) : ''
    if (!title) return badRequest('Title is required')

    const projectId = typeof body.projectId === 'string' && body.projectId ? body.projectId : null
    if (projectId && !(await ownsProject(user.id, projectId))) return badRequest('Invalid project')

    const missionId = typeof body.missionId === 'string' && body.missionId ? body.missionId : null
    if (missionId && !(await ownsMission(user.id, missionId))) return badRequest('Invalid mission')
    const dependsOn = sanitizeIds(body.dependsOn)
    const status = parseTaskStatus(body.status) || 'todo'
    // Nouvelle tâche en bas de sa colonne
    const last = await prisma.task.aggregate({ where: { userId: user.id }, _max: { order: true } })

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title,
        description: parseText(5000)(body.description) || null,
        notes: parseText(20000)(body.notes) || null,
        priority: parsePriority(body.priority) || 'medium',
        status,
        dueDate: parseDay(body.dueDate) || null,
        startDate: parseDay(body.startDate) || null,
        missionId,
        projectId,
        checklist: sanitizeChecklist(body.checklist) ?? [],
        links: sanitizeLinks(body.links) ?? [],
        dependsOn: dependsOn ? (await validDependencies(user.id, null, dependsOn)) ?? [] : [],
        recurrence: parseRecurrence(body.recurrence) || null,
        showInCalendar: body.showInCalendar === true,
        order: (last._max.order ?? 0) + 1,
        completedAt: status === 'done' ? new Date().toISOString() : null,
      },
    })

    if (!missionId) {
      await logActivity(user.id, [{ projectId, taskId: task.id, message: `Tâche créée : « ${task.title} »` }])
    }

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

// PUT update a task. Les champs absents restent inchangés.
// Réponse : la tâche, plus `nextOccurrence` quand terminer une tâche récurrente a créé la suivante.
export async function PUT(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const body = await request.json()
    const { id } = body
    if (!id) return badRequest('ID is required')

    const existing = await prisma.task.findFirst({ where: { id, userId: user.id, deletedAt: null } })
    if (!existing) return notFound('Task not found')

    const projectId = nullable(body.projectId, (v) => (typeof v === 'string' ? v : undefined))
    if (projectId && projectId !== existing.projectId && !(await ownsProject(user.id, projectId))) {
      return badRequest('Invalid project')
    }
    const missionId = nullable(body.missionId, (v) => (typeof v === 'string' ? v : undefined))
    if (missionId && missionId !== existing.missionId && !(await ownsMission(user.id, missionId))) {
      return badRequest('Invalid mission')
    }

    let dependsOn: string[] | undefined
    const requestedDeps = sanitizeIds(body.dependsOn)
    if (requestedDeps) {
      const valid = await validDependencies(user.id, id, requestedDeps)
      if (!valid) return badRequest('Cette dépendance créerait une boucle entre les tâches')
      dependsOn = valid
    }

    const status = parseTaskStatus(body.status)
    const becameDone = status === 'done' && existing.status !== 'done'
    const reopened = status !== undefined && status !== 'done' && existing.status === 'done'
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 500) : undefined

    const data: Prisma.TaskUncheckedUpdateInput = {
      title,
      description: nullable(body.description, parseText(5000)),
      notes: nullable(body.notes, parseText(20000)),
      priority: parsePriority(body.priority),
      status,
      dueDate: nullable(body.dueDate, parseDay),
      startDate: nullable(body.startDate, parseDay),
      missionId,
      projectId,
      checklist: sanitizeChecklist(body.checklist),
      links: sanitizeLinks(body.links),
      dependsOn,
      recurrence: nullable(body.recurrence, parseRecurrence),
      showInCalendar: typeof body.showInCalendar === 'boolean' ? body.showInCalendar : undefined,
      // Pas de `order` ici : la position ne change que par /api/tasks/reorder (sinon une modification
      // envoyée avec une tâche un peu ancienne annulerait un glisser-déposer)
      completedAt: becameDone
        ? (typeof body.completedAt === 'string' ? body.completedAt : new Date().toISOString())
        : reopened ? null : undefined,
    }

    const recurrence = data.recurrence === undefined ? existing.recurrence : (data.recurrence as typeof existing.recurrence)
    // La récurrence passe à l'occurrence suivante : rouvrir puis refermer celle-ci n'en recrée pas une autre
    if (becameDone && recurrence) data.recurrence = null

    const task = await prisma.task.update({ where: { id }, data })

    let next = null
    if (becameDone && recurrence) {
      const base = toDay(task.dueDate) || toDay(task.completedAt) || new Date().toISOString().slice(0, 10)
      const shift = (day: string | null) => (day ? nextOccurrence(day, recurrence) : null)
      const last = await prisma.task.aggregate({ where: { userId: user.id }, _max: { order: true } })
      next = await prisma.task.create({
        data: {
          userId: user.id,
          title: task.title,
          description: task.description,
          notes: task.notes,
          priority: task.priority,
          status: 'todo',
          dueDate: nextOccurrence(base, recurrence),
          startDate: shift(toDay(task.startDate) || null),
          projectId: task.projectId,
          missionId: task.missionId,
          // Checklist décochée pour la nouvelle occurrence
          checklist: (Array.isArray(task.checklist) ? task.checklist : []).map((i: any) => ({ ...i, done: false })),
          links: (task.links ?? []) as Prisma.InputJsonValue,
          dependsOn: [],
          recurrence,
          showInCalendar: task.showInCalendar,
          order: (last._max.order ?? 0) + 1,
        },
      })
    }

    if (!task.missionId) {
      const changes = describeTaskChanges(existing, task, await projectTitles(user.id))
      if (existing.showInCalendar !== task.showInCalendar) {
        changes.push(`« ${task.title} » ${task.showInCalendar ? 'affichée dans' : 'retirée du'} calendrier principal`)
      }
      const entries = changes.map((message) => ({ projectId: task.projectId, taskId: task.id, message }))
      if (next) entries.push({ projectId: task.projectId, taskId: next.id, message: `Prochaine occurrence créée : « ${next.title} »` })
      await logActivity(user.id, entries)
    }

    return NextResponse.json({ ...task, nextOccurrence: next })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

// DELETE a task : elle part à la corbeille (restaurable 30 jours)
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    // Le client envoie l'id dans l'URL (?id=…), sans corps : request.json() échouait et la tâche restait
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return badRequest('ID is required')

    const existingTask = await prisma.task.findFirst({ where: { id, userId: user.id, deletedAt: null } })
    if (!existingTask) return notFound('Task not found')

    await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } })

    if (!existingTask.missionId) {
      // Sans taskId : l'entrée reste dans l'historique du projet même après suppression définitive
      await logActivity(user.id, [{ projectId: existingTask.projectId, message: `Tâche mise à la corbeille : « ${existingTask.title} »` }])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
