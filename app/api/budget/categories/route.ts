import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { parseMoney } from '@/lib/budget'

const parseName = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : null)
const parseColor = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null)
// Plafond : vide = sans plafond
const parseLimit = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null
  const amount = parseMoney(v)
  return amount != null && amount >= 0 ? amount : undefined
}

// POST /api/budget/categories { name, limitAmount?, color? }
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const name = parseName(body.name)
  const limitAmount = parseLimit(body.limitAmount)
  if (!name) return badRequest('Nom requis')
  if (limitAmount === undefined) return badRequest('Plafond invalide')
  if ((await prisma.budgetCategory.count({ where: { userId: user.id } })) >= 100) return badRequest('Trop de catégories')

  const last = await prisma.budgetCategory.aggregate({ where: { userId: user.id }, _max: { order: true } })
  const { userId, ...category } = await prisma.budgetCategory.create({
    data: { userId: user.id, name, limitAmount, color: parseColor(body.color), order: (last._max.order ?? 0) + 1 },
  })
  return NextResponse.json(category, { status: 201 })
}

// PUT /api/budget/categories { id, name?, limitAmount?, color? }
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const existing = typeof body.id === 'string' ? await prisma.budgetCategory.findFirst({ where: { id: body.id, userId: user.id } }) : null
  if (!existing) return notFound('Catégorie introuvable')

  const limitAmount = body.limitAmount === undefined ? existing.limitAmount : parseLimit(body.limitAmount)
  if (limitAmount === undefined) return badRequest('Plafond invalide')
  const { userId, ...category } = await prisma.budgetCategory.update({
    where: { id: existing.id },
    data: {
      name: parseName(body.name) ?? existing.name,
      limitAmount,
      color: body.color === undefined ? existing.color : parseColor(body.color),
    },
  })
  return NextResponse.json(category)
}

// DELETE /api/budget/categories?id=… — ses dépenses restent, sans catégorie
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return badRequest('ID requis')
  const { count } = await prisma.budgetCategory.deleteMany({ where: { id, userId: user.id } })
  if (!count) return notFound('Catégorie introuvable')
  return NextResponse.json({ success: true })
}
