import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { snapshotProject } from '@/lib/projects/tree'

// GET /api/project-templates — modèles enregistrés par l'utilisateur
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const templates = await prisma.projectTemplate.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(templates)
}

// POST /api/project-templates { projectId, name, description? } — enregistre un projet existant comme modèle
export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : ''
    if (!name || typeof body.projectId !== 'string') return badRequest('Name and project are required')

    const snapshot = await snapshotProject(user.id, body.projectId)
    if (!snapshot) return notFound('Project not found')

    const template = await prisma.projectTemplate.create({
      data: {
        userId: user.id,
        name,
        description: typeof body.description === 'string' ? body.description.slice(0, 500) || null : null,
        data: snapshot.data as unknown as Prisma.InputJsonValue,
      },
    })
    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating project template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}

// DELETE /api/project-templates?id=…
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return badRequest('ID is required')
  const { count } = await prisma.projectTemplate.deleteMany({ where: { id, userId: user.id } })
  if (!count) return notFound('Template not found')
  return NextResponse.json({ success: true })
}
