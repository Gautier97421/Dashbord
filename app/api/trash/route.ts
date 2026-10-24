import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  badRequest,
  deleteProjectPermanently,
  deleteTasksPermanently,
  getSessionUser,
  logActivity,
  notFound,
  purgeExpiredTrash,
  restoreProjectTree,
  TRASH_RETENTION_DAYS,
  unauthorized,
} from '@/lib/projects/server'

/**
 * GET    /api/trash — éléments à la corbeille (ceux de plus de 30 jours sont d'abord supprimés)
 * POST   /api/trash { action: "restore" | "delete", type: "project" | "task", id }
 * DELETE /api/trash — vide la corbeille
 *
 * Un projet jeté emporte ses sous-projets et leurs tâches (même date de suppression) : seul le projet
 * de départ est listé, et le restaurer ramène tout le lot.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  await purgeExpiredTrash(user.id)

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: { userId: user.id, deletedAt: { not: null } },
      select: { id: true, title: true, parentId: true, deletedAt: true },
      orderBy: { deletedAt: 'desc' },
    }),
    prisma.task.findMany({
      where: { userId: user.id, deletedAt: { not: null } },
      select: { id: true, title: true, projectId: true, deletedAt: true, missionId: true },
      orderBy: { deletedAt: 'desc' },
    }),
  ])

  const trashedProject = new Map(projects.map((p) => [p.id, p]))
  const sameBatch = (a?: Date | null, b?: Date | null) => !!a && !!b && a.getTime() === b.getTime()
  const childCount = (id: string) => projects.filter((p) => p.parentId === id).length

  const rootProjects = projects
    .filter((p) => !(p.parentId && sameBatch(trashedProject.get(p.parentId)?.deletedAt, p.deletedAt)))
    .map((p) => ({
      ...p,
      subprojects: childCount(p.id),
      tasks: tasks.filter((t) => t.projectId === p.id && sameBatch(t.deletedAt, p.deletedAt)).length,
    }))
  const looseTasks = tasks
    .filter((t) => !t.missionId)
    .filter((t) => !(t.projectId && sameBatch(trashedProject.get(t.projectId)?.deletedAt, t.deletedAt)))

  return NextResponse.json({ projects: rootProjects, tasks: looseTasks, retentionDays: TRASH_RETENTION_DAYS })
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const { action, type, id } = await request.json()
    if (typeof id !== 'string' || !['restore', 'delete'].includes(action) || !['project', 'task'].includes(type)) {
      return badRequest('Invalid request')
    }

    if (type === 'project') {
      const project = await prisma.project.findFirst({ where: { id, userId: user.id, deletedAt: { not: null } } })
      if (!project) return notFound('Project not found')
      if (action === 'restore') {
        await restoreProjectTree(user.id, id)
        await logActivity(user.id, [{ projectId: id, message: `Projet restauré depuis la corbeille : « ${project.title} »` }])
      } else {
        await deleteProjectPermanently(user.id, id)
      }
    } else {
      const task = await prisma.task.findFirst({ where: { id, userId: user.id, deletedAt: { not: null } } })
      if (!task) return notFound('Task not found')
      if (action === 'restore') {
        await prisma.task.update({ where: { id }, data: { deletedAt: null } })
        await logActivity(user.id, [{ projectId: task.projectId, taskId: id, message: `Tâche restaurée depuis la corbeille : « ${task.title} »` }])
      } else {
        await deleteTasksPermanently(user.id, [id])
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating trash:', error)
    return NextResponse.json({ error: 'Failed to update trash' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    // Projets d'abord : leurs tâches jetées en même temps partent avec eux
    const projects = await prisma.project.findMany({ where: { userId: user.id, deletedAt: { not: null } }, select: { id: true } })
    for (const p of projects) {
      if (await prisma.project.findUnique({ where: { id: p.id }, select: { id: true } })) {
        await deleteProjectPermanently(user.id, p.id)
      }
    }
    const tasks = await prisma.task.findMany({ where: { userId: user.id, deletedAt: { not: null } }, select: { id: true } })
    await deleteTasksPermanently(user.id, tasks.map((t) => t.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error emptying trash:', error)
    return NextResponse.json({ error: 'Failed to empty trash' }, { status: 500 })
  }
}
