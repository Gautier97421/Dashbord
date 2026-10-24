import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { isRateLimited, recordAttempt } from '@/lib/rate-limit'
import { refreshItem, refreshStaleItems } from '@/lib/wishlist/server'

const FETCH_LIMIT = 40
const FETCH_WINDOW_MS = 10 * 60_000

/**
 * POST /api/wishlist/refresh { id }        — relit le prix d'un article (lien principal et autres offres)
 * POST /api/wishlist/refresh { all: true } — relit les articles non achetés (15 au plus, les plus anciens d'abord)
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))

  if (body.all === true) {
    const key = `wishlist-refresh-all:${user.id}`
    if (isRateLimited(key, 1, 60_000)) {
      return NextResponse.json({ error: 'Actualisation déjà lancée il y a moins d\'une minute' }, { status: 429 })
    }
    recordAttempt(key, 60_000)
    const items = await refreshStaleItems(user.id, true)
    return NextResponse.json({ items })
  }

  if (typeof body.id !== 'string') return badRequest('ID requis')
  const key = `wishlist-fetch:${user.id}`
  if (isRateLimited(key, FETCH_LIMIT, FETCH_WINDOW_MS)) {
    return NextResponse.json({ error: 'Trop de lectures de pages, réessaie dans quelques minutes' }, { status: 429 })
  }
  const item = await prisma.wishlistItem.findFirst({ where: { id: body.id, userId: user.id } })
  if (!item) return notFound('Article introuvable')
  recordAttempt(key, FETCH_WINDOW_MS)
  return NextResponse.json(await refreshItem(item))
}
