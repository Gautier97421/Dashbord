import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, unauthorized } from '@/lib/projects/server'

// POST /api/projects/reorder { items: [{ id, order }] } — positions parmi les projets d'un même parent
export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : null
    if (!items || items.length > 1000) return badRequest('Invalid items')

    const valid = items.filter((i: any) => typeof i?.id === 'string' && Number.isInteger(i.order)) as { id: string; order: number }[]
    await prisma.$transaction(
      valid.map((i) => prisma.project.updateMany({ where: { id: i.id, userId: user.id }, data: { order: i.order } }))
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering projects:', error)
    return NextResponse.json({ error: 'Failed to reorder projects' }, { status: 500 })
  }
}
