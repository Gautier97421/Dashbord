import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'

const parseName = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : null)

// POST /api/wishlist/lists { name }
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const name = parseName(body.name)
  if (!name) return badRequest('Nom requis')
  if ((await prisma.wishlistList.count({ where: { userId: user.id } })) >= 50) return badRequest('Trop de listes')

  const last = await prisma.wishlistList.aggregate({ where: { userId: user.id }, _max: { order: true } })
  const list = await prisma.wishlistList.create({
    data: { userId: user.id, name, order: (last._max.order ?? 0) + 1 },
  })
  return NextResponse.json({ id: list.id, name: list.name, order: list.order }, { status: 201 })
}

// PUT /api/wishlist/lists { id, name }
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const existing = typeof body.id === 'string' ? await prisma.wishlistList.findFirst({ where: { id: body.id, userId: user.id } }) : null
  if (!existing) return notFound('Liste introuvable')

  const list = await prisma.wishlistList.update({
    where: { id: existing.id },
    data: { name: parseName(body.name) ?? existing.name },
  })
  return NextResponse.json({ id: list.id, name: list.name, order: list.order })
}

// DELETE /api/wishlist/lists?id=… — supprime la liste et ses articles
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return badRequest('ID requis')
  const { count } = await prisma.wishlistList.deleteMany({ where: { id, userId: user.id } })
  if (!count) return notFound('Liste introuvable')
  return NextResponse.json({ success: true })
}
