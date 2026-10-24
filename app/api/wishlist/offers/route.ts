import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { isRateLimited, recordAttempt } from '@/lib/rate-limit'
import { fetchProduct, storeFromHost } from '@/lib/wishlist/fetch-product'
import { readOffers, serializeItem } from '@/lib/wishlist/server'
import { MAX_OFFERS, parseHttpUrl, parsePrice, type WishlistOffer } from '@/lib/wishlist/shared'

const FETCH_LIMIT = 40
const FETCH_WINDOW_MS = 10 * 60_000

// Montant facultatif : null si vide, undefined si invalide
const parseAmount = (v: unknown) => (v === undefined || v === null || v === '' ? null : parsePrice(String(v)) ?? undefined)

/**
 * POST /api/wishlist/offers { itemId, url, price? }
 *   Ajoute le même produit vendu ailleurs, pour comparer ; sans prix, il est lu sur la page.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const item = typeof body.itemId === 'string' ? await prisma.wishlistItem.findFirst({ where: { id: body.itemId, userId: user.id } }) : null
  if (!item) return notFound('Article introuvable')
  const url = parseHttpUrl(body.url)
  if (!url) return badRequest('Lien invalide')
  const manualPrice = parseAmount(body.price)
  if (manualPrice === undefined) return badRequest('Montant invalide')

  const offers = readOffers(item.offers)
  if (offers.length >= MAX_OFFERS) return badRequest(`${MAX_OFFERS} offres au plus par article`)
  if (item.url === url || offers.some((o) => o.url === url)) return badRequest('Ce lien est déjà dans la comparaison')

  const offer: WishlistOffer = {
    id: randomUUID(),
    url,
    store: storeFromHost(new URL(url).hostname),
    price: manualPrice,
    currency: item.currency,
    checkedAt: null,
    error: null,
  }
  const key = `wishlist-fetch:${user.id}`
  if (manualPrice == null && !isRateLimited(key, FETCH_LIMIT, FETCH_WINDOW_MS)) {
    recordAttempt(key, FETCH_WINDOW_MS)
    const result = await fetchProduct(url)
    offer.checkedAt = new Date().toISOString()
    if (result.ok) {
      offer.store = result.info.store || offer.store
      offer.price = result.info.price
      offer.currency = result.info.currency || offer.currency
      if (result.info.price == null) offer.error = 'Prix introuvable sur la page'
    } else {
      offer.error = result.error
    }
  }

  const updated = await prisma.wishlistItem.update({
    where: { id: item.id },
    data: { offers: [...offers, offer] as unknown as Prisma.InputJsonValue },
  })
  return NextResponse.json(serializeItem(updated), { status: 201 })
}

// PUT /api/wishlist/offers { itemId, offerId, price } — prix saisi à la main (site qui bloque la lecture)
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const item = typeof body.itemId === 'string' ? await prisma.wishlistItem.findFirst({ where: { id: body.itemId, userId: user.id } }) : null
  if (!item) return notFound('Article introuvable')
  const price = parseAmount(body.price)
  if (price === undefined) return badRequest('Montant invalide')
  const offers = readOffers(item.offers)
  if (!offers.some((o) => o.id === body.offerId)) return notFound('Offre introuvable')

  const updated = await prisma.wishlistItem.update({
    where: { id: item.id },
    data: {
      offers: offers.map((o) => (o.id === body.offerId ? { ...o, price, error: null } : o)) as unknown as Prisma.InputJsonValue,
    },
  })
  return NextResponse.json(serializeItem(updated))
}

// DELETE /api/wishlist/offers?itemId=…&offerId=…
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const params = new URL(request.url).searchParams
  const itemId = params.get('itemId')
  const item = itemId ? await prisma.wishlistItem.findFirst({ where: { id: itemId, userId: user.id } }) : null
  if (!item) return notFound('Article introuvable')
  const offers = readOffers(item.offers)
  const rest = offers.filter((o) => o.id !== params.get('offerId'))
  if (rest.length === offers.length) return notFound('Offre introuvable')

  const updated = await prisma.wishlistItem.update({
    where: { id: item.id },
    data: { offers: rest.length ? (rest as unknown as Prisma.InputJsonValue) : Prisma.DbNull },
  })
  return NextResponse.json(serializeItem(updated))
}
