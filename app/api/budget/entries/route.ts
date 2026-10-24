import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, parseDay, unauthorized } from '@/lib/projects/server'
import { parseMoney } from '@/lib/budget'

type EntryInput = { label: string; amount: number; kind: string; date: string; categoryId: string | null; notes: string | null }

// Valide une dépense / un revenu ; `partial` : modification (champs absents = inchangés)
async function parseEntry(userId: string, body: any, current?: EntryInput): Promise<EntryInput | string> {
  const label = body.label === undefined && current ? current.label : typeof body.label === 'string' ? body.label.trim().slice(0, 120) : ''
  if (!label) return 'Libellé requis'
  const amount = body.amount === undefined && current ? current.amount : parseMoney(body.amount)
  if (amount == null || amount <= 0) return 'Montant invalide'
  const kind = body.kind === undefined && current ? current.kind : body.kind === 'income' ? 'income' : 'expense'
  const date = body.date === undefined && current ? current.date : parseDay(body.date)
  if (!date) return 'Date invalide'
  let categoryId = body.categoryId === undefined && current ? current.categoryId : typeof body.categoryId === 'string' && body.categoryId ? body.categoryId : null
  if (categoryId && !(await prisma.budgetCategory.findFirst({ where: { id: categoryId, userId }, select: { id: true } }))) categoryId = null
  const notes = body.notes === undefined && current ? current.notes : typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 500) : null
  return { label, amount, kind, date, categoryId: kind === 'income' ? null : categoryId, notes }
}

// POST /api/budget/entries { label, amount, kind?, date, categoryId?, notes? }
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const parsed = await parseEntry(user.id, await request.json().catch(() => ({})))
  if (typeof parsed === 'string') return badRequest(parsed)
  const { userId, ...entry } = await prisma.budgetEntry.create({ data: { userId: user.id, ...parsed } })
  return NextResponse.json(entry, { status: 201 })
}

// PUT /api/budget/entries { id, … }
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const existing = typeof body.id === 'string' ? await prisma.budgetEntry.findFirst({ where: { id: body.id, userId: user.id } }) : null
  if (!existing) return notFound('Opération introuvable')
  const parsed = await parseEntry(user.id, body, existing)
  if (typeof parsed === 'string') return badRequest(parsed)
  const { userId, ...entry } = await prisma.budgetEntry.update({ where: { id: existing.id }, data: parsed })
  return NextResponse.json(entry)
}

// DELETE /api/budget/entries?id=…
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return badRequest('ID requis')
  const { count } = await prisma.budgetEntry.deleteMany({ where: { id, userId: user.id } })
  if (!count) return notFound('Opération introuvable')
  return NextResponse.json({ success: true })
}
