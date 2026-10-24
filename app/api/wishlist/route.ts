import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/projects/server'
import { maybeRefreshInBackground, serializeItem } from '@/lib/wishlist/server'

// GET /api/wishlist — listes et articles ; relance en arrière-plan la lecture des prix trop anciens
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const [lists, items] = await Promise.all([
    prisma.wishlistList.findMany({ where: { userId: user.id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
    prisma.wishlistItem.findMany({ where: { userId: user.id }, orderBy: [{ order: 'asc' }, { createdAt: 'desc' }] }),
  ])
  maybeRefreshInBackground(user.id)

  return NextResponse.json({
    lists: lists.map(({ id, name, order }) => ({ id, name, order })),
    items: items.map(serializeItem),
  })
}
