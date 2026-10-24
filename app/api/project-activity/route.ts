import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'

/**
 * GET    /api/project-activity?projectIds=a,b | ?taskId=… | ?recent=1 | ?q=texte
 *        Historique et commentaires (les plus récents d'abord)
 * POST   /api/project-activity { projectId? | taskId?, message } — ajoute un commentaire
 * DELETE /api/project-activity?id=… — supprime un commentaire
 */
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const params = new URL(request.url).searchParams
  const where: Prisma.ProjectActivityWhereInput = { userId: user.id }
  const projectIds = params.get('projectIds')?.split(',').filter(Boolean).slice(0, 200)
  const taskId = params.get('taskId')
  const q = params.get('q')?.trim()

  if (taskId) where.taskId = taskId
  else if (projectIds?.length) where.projectId = { in: projectIds }
  else if (q) {
    if (q.length < 2) return NextResponse.json([])
    where.kind = 'comment'
    where.message = { contains: q, mode: 'insensitive' }
  } else if (!params.get('recent')) return badRequest('Filter is required')

  const items = await prisma.projectActivity.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(params.get('limit')) || 100, 200),
    include: { project: { select: { title: true } }, task: { select: { title: true } } },
  })

  return NextResponse.json(
    items.map((i) => ({
      id: i.id,
      kind: i.kind,
      message: i.message,
      createdAt: i.createdAt,
      projectId: i.projectId,
      taskId: i.taskId,
      projectTitle: i.project?.title ?? null,
      taskTitle: i.task?.title ?? null,
    }))
  )
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const body = await request.json()
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : ''
    if (!message) return badRequest('Message is required')

    let projectId: string | null = null
    let taskId: string | null = null
    if (typeof body.taskId === 'string') {
      const task = await prisma.task.findFirst({ where: { id: body.taskId, userId: user.id }, select: { id: true, projectId: true } })
      if (!task) return notFound('Task not found')
      taskId = task.id
      // Le commentaire d'une tâche apparaît aussi dans l'activité de son projet
      projectId = task.projectId
    } else if (typeof body.projectId === 'string') {
      const project = await prisma.project.findFirst({ where: { id: body.projectId, userId: user.id }, select: { id: true } })
      if (!project) return notFound('Project not found')
      projectId = project.id
    } else {
      return badRequest('Project or task is required')
    }

    const comment = await prisma.projectActivity.create({
      data: { userId: user.id, projectId, taskId, kind: 'comment', message },
    })
    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error adding comment:', error)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return badRequest('ID is required')
  // Seuls les commentaires se suppriment : l'historique des modifications reste intact
  const { count } = await prisma.projectActivity.deleteMany({ where: { id, userId: user.id, kind: 'comment' } })
  if (!count) return notFound('Comment not found')
  return NextResponse.json({ success: true })
}
