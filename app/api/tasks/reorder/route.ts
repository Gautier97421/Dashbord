import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, unauthorized } from '@/lib/projects/server'

// POST /api/tasks/reorder { items: [{ id, order }] } — positions après un glisser-déposer
export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : null
    if (!items || items.length > 1000) return badRequest('Invalid items')

    const valid = items.filter((i: any) => typeof i?.id === 'string' && Number.isInteger(i.order)) as { id: string; order: number }[]
    await prisma.$transaction(
      valid.map((i) => prisma.task.updateMany({ where: { id: i.id, userId: user.id }, data: { order: i.order } }))
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering tasks:', error)
    return NextResponse.json({ error: 'Failed to reorder tasks' }, { status: 500 })
  }
}
