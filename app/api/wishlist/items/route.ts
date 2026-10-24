import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { isRateLimited, recordAttempt } from '@/lib/rate-limit'
import { fetchProduct, storeFromHost } from '@/lib/wishlist/fetch-product'
import { addPricePoint, serializeItem } from '@/lib/wishlist/server'
import { CURRENCIES, parseHttpUrl, parsePrice } from '@/lib/wishlist/shared'

const FETCH_LIMIT = 40
const FETCH_WINDOW_MS = 10 * 60_000

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

// Montant facultatif : vide = aucun, sinon un nombre positif
const parseAmount = (v: unknown): number | null | undefined => {
  if (v === null || v === '' || v === undefined) return null
  const amount = parsePrice(typeof v === 'number' ? v : String(v))
  return amount ?? undefined
}

const parseCurrency = (v: unknown) => (typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v) ? v : null)
const parseQuantity = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN
  return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null
}

async function ownList(userId: string, listId: unknown) {
  if (listId === null || listId === '' || listId === undefined) return null
  if (typeof listId !== 'string') return undefined
  return (await prisma.wishlistList.findFirst({ where: { id: listId, userId }, select: { id: true } }))?.id ?? undefined
}

/**
 * POST /api/wishlist/items { url?, title?, price?, currency?, listId?, quantity?, notes?, promoCode?, imageUrl?, store? }
 *   Avec un lien et sans titre ou sans prix, la page est lue pour les compléter.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))

  const url = parseHttpUrl(body.url)
  if (url === undefined) return badRequest('Lien invalide')
  const listId = await ownList(user.id, body.listId)
  if (listId === undefined) return badRequest('Liste introuvable')
  const price = parseAmount(body.price)
  if (price === undefined) return badRequest('Montant invalide')
  if ((await prisma.wishlistItem.count({ where: { userId: user.id } })) >= 1000) return badRequest("Trop d'articles")

  let title = text(body.title, 200)
  let imageUrl = parseHttpUrl(body.imageUrl) ?? null
  let store = text(body.store, 60)
  let currency = parseCurrency(body.currency)
  let fetchedPrice: number | null = null
  let checkError: string | null = null
  let checked = false

  if (url && (!title || price == null) && !isRateLimited(`wishlist-fetch:${user.id}`, FETCH_LIMIT, FETCH_WINDOW_MS)) {
    recordAttempt(`wishlist-fetch:${user.id}`, FETCH_WINDOW_MS)
    const result = await fetchProduct(url)
    checked = true
    if (result.ok) {
      title ??= result.info.title
      imageUrl ??= result.info.imageUrl
      store ??= result.info.store
      currency ??= parseCurrency(result.info.currency)
      fetchedPrice = result.info.price
      if (fetchedPrice == null) checkError = 'Prix introuvable sur la page'
    } else {
      checkError = result.error
    }
  }
  if (url && !store) store = storeFromHost(new URL(url).hostname)
  if (!title) title = store || 'Article'

  const finalPrice = price ?? fetchedPrice
  const last = await prisma.wishlistItem.aggregate({ where: { userId: user.id }, _min: { order: true } })
  const item = await prisma.wishlistItem.create({
    data: {
      userId: user.id,
      listId,
      title,
      url,
      imageUrl,
      store,
      price: finalPrice,
      currency: currency ?? 'EUR',
      quantity: parseQuantity(body.quantity) ?? 1,
      notes: text(body.notes, 2000),
      promoCode: text(body.promoCode, 60),
      priceHistory: addPricePoint([], finalPrice) as unknown as Prisma.InputJsonValue,
      lastCheckedAt: checked ? new Date() : null,
      checkError,
      // Nouveaux articles en tête
      order: (last._min.order ?? 0) - 1,
    },
  })
  return NextResponse.json(serializeItem(item), { status: 201 })
}

// PUT /api/wishlist/items { id, …champs modifiés, purchased? }
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const existing = typeof body.id === 'string' ? await prisma.wishlistItem.findFirst({ where: { id: body.id, userId: user.id } }) : null
  if (!existing) return notFound('Article introuvable')

  const data: Prisma.WishlistItemUpdateInput = {}
  if (body.title !== undefined) {
    const title = text(body.title, 200)
    if (!title) return badRequest('Titre requis')
    data.title = title
  }
  if (body.url !== undefined) {
    const url = parseHttpUrl(body.url)
    if (url === undefined) return badRequest('Lien invalide')
    data.url = url
    if (url !== existing.url) {
      data.checkError = null
      data.lastCheckedAt = null
    }
  }
  if (body.imageUrl !== undefined) {
    const imageUrl = parseHttpUrl(body.imageUrl)
    if (imageUrl === undefined) return badRequest('Image invalide')
    data.imageUrl = imageUrl
  }
  if (body.listId !== undefined) {
    const listId = await ownList(user.id, body.listId)
    if (listId === undefined) return badRequest('Liste introuvable')
    data.list = listId ? { connect: { id: listId } } : { disconnect: true }
  }
  if (body.price !== undefined) {
    const amount = parseAmount(body.price)
    if (amount === undefined) return badRequest('Montant invalide')
    data.price = amount
  }
  if (data.price !== undefined && data.price !== existing.price) {
    // Prix saisi à la main : il compte dans l'historique
    const history = serializeItem(existing).priceHistory
    data.priceHistory = addPricePoint(history, data.price as number | null) as unknown as Prisma.InputJsonValue
  }
  if (body.currency !== undefined) data.currency = parseCurrency(body.currency) ?? existing.currency
  if (body.store !== undefined) data.store = text(body.store, 60)
  if (body.quantity !== undefined) data.quantity = parseQuantity(body.quantity) ?? existing.quantity
  if (body.notes !== undefined) data.notes = text(body.notes, 2000)
  if (body.promoCode !== undefined) data.promoCode = text(body.promoCode, 60)
  if (typeof body.purchased === 'boolean' && body.purchased !== existing.purchased) {
    data.purchased = body.purchased
    data.purchasedAt = body.purchased ? new Date() : null
  }

  const item = await prisma.wishlistItem.update({ where: { id: existing.id }, data })
  return NextResponse.json(serializeItem(item))
}

// DELETE /api/wishlist/items?id=…
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return badRequest('ID requis')
  const { count } = await prisma.wishlistItem.deleteMany({ where: { id, userId: user.id } })
  if (!count) return notFound('Article introuvable')
  return NextResponse.json({ success: true })
}
