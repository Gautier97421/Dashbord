import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BUILTIN_TEMPLATES } from '@/lib/project-templates'
import { badRequest, getSessionUser, notFound, parseDay, unauthorized } from '@/lib/projects/server'
import { instantiateTemplate, isTemplateData } from '@/lib/projects/tree'

// POST /api/projects/from-template { builtin? | templateId?, title?, startDate?, parentId? }
export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const body = await request.json()
    let data: unknown
    let name: string
    if (typeof body.builtin === 'string') {
      const builtin = BUILTIN_TEMPLATES.find((t) => t.key === body.builtin)
      if (!builtin) return notFound('Template not found')
      data = builtin.data
      name = builtin.name
    } else if (typeof body.templateId === 'string') {
      const template = await prisma.projectTemplate.findFirst({ where: { id: body.templateId, userId: user.id } })
      if (!template) return notFound('Template not found')
      data = template.data
      name = template.name
    } else {
      return badRequest('Template is required')
    }
    if (!isTemplateData(data)) return badRequest('Invalid template')

    const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null
    if (parentId && !(await prisma.project.findFirst({ where: { id: parentId, userId: user.id, deletedAt: null } }))) {
      return badRequest('Invalid parent project')
    }

    const projectId = await instantiateTemplate(user.id, data, {
      title: typeof body.title === 'string' ? body.title : undefined,
      startDate: parseDay(body.startDate) || new Date().toISOString().slice(0, 10),
      parentId,
      source: `le modèle « ${name} »`,
    })

    return NextResponse.json({ projectId }, { status: 201 })
  } catch (error) {
    console.error('Error creating project from template:', error)
    return NextResponse.json({ error: 'Failed to create project from template' }, { status: 500 })
  }
}
