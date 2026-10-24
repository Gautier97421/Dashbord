import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, unauthorized } from '@/lib/projects/server'
import { normalizeUsername, userSelect } from '@/lib/social'

// GET /api/profile — nom, e-mail et pseudo du compte connecté
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: userSelect })
  return NextResponse.json(me)
}

// PUT /api/profile { name?, username? } — le pseudo est unique (insensible à la casse)
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const data: { name?: string; username?: string } = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 100) return badRequest('Le nom doit contenir 2 à 100 caractères')
    data.name = name
  }
  if (body.username !== undefined) {
    const username = normalizeUsername(body.username)
    if (!username) return badRequest('Pseudo invalide : 3 à 20 caractères (lettres, chiffres, . et _)')
    data.username = username
  }

  try {
    const me = await prisma.user.update({ where: { id: user.id }, data, select: userSelect })
    return NextResponse.json(me)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Ce pseudo est déjà pris' }, { status: 409 })
    }
    throw error
  }
}
