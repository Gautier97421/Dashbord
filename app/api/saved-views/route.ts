import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'

const SCOPES = ['projects', 'tasks']

// GET /api/saved-views?scope=projects|tasks
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const scope = new URL(request.url).searchParams.get('scope')
  const views = await prisma.savedView.findMany({
    where: { userId: user.id, ...(scope && SCOPES.includes(scope) ? { scope } : {}) },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(views)
}

// POST /api/saved-views { scope, name, filters }
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''
  if (!name || !SCOPES.includes(body.scope) || !body.filters || typeof body.filters !== 'object') {
    return badRequest('Invalid view')
  }
  if (JSON.stringify(body.filters).length > 5000) return badRequest('Filters too large')
  if ((await prisma.savedView.count({ where: { userId: user.id } })) >= 50) return badRequest('Trop de vues enregistrées')

  const view = await prisma.savedView.create({
    data: { userId: user.id, scope: body.scope, name, filters: body.filters as Prisma.InputJsonValue },
  })
  return NextResponse.json(view, { status: 201 })
}

// DELETE /api/saved-views?id=…
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return badRequest('ID is required')
  const { count } = await prisma.savedView.deleteMany({ where: { id, userId: user.id } })
  if (!count) return notFound('View not found')
  return NextResponse.json({ success: true })
}
