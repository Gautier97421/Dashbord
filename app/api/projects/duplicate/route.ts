import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { instantiateTemplate, snapshotProject } from '@/lib/projects/tree'

// POST /api/projects/duplicate { id } — copie le projet, ses sous-projets et leurs tâches (progression remise à zéro)
export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const { id } = await request.json()
    if (typeof id !== 'string') return badRequest('ID is required')

    const original = await prisma.project.findFirst({ where: { id, userId: user.id, deletedAt: null } })
    if (!original) return notFound('Project not found')

    const snapshot = await snapshotProject(user.id, id)
    if (!snapshot) return notFound('Project not found')

    const projectId = await instantiateTemplate(user.id, snapshot.data, {
      title: `${original.title} (copie)`,
      // Mêmes dates que l'original
      startDate: snapshot.baseDay,
      parentId: original.parentId,
      source: `la copie de « ${original.title} »`,
    })

    return NextResponse.json({ projectId }, { status: 201 })
  } catch (error) {
    console.error('Error duplicating project:', error)
    return NextResponse.json({ error: 'Failed to duplicate project' }, { status: 500 })
  }
}
