// Wishlist côté serveur : mise en forme, actualisation des prix et alertes de baisse.

import { Prisma, type WishlistItem as DbItem } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { sendPushToUser } from "@/lib/push"
import { fetchProduct } from "@/lib/wishlist/fetch-product"
import { MAX_HISTORY, bestOffer, formatPrice, type PricePoint, type WishlistItem, type WishlistOffer } from "@/lib/wishlist/shared"

// Un prix est relu au plus une fois par jour en automatique
const STALE_MS = 20 * 3_600_000
const LAZY_MIN_GAP_MS = 3_600_000
const MAX_PER_RUN = 15
const lastLazyRun = new Map<string, number>()

export function readOffers(value: Prisma.JsonValue | null): WishlistOffer[] {
  if (!Array.isArray(value)) return []
  return value.filter((o): o is Prisma.JsonObject => !!o && typeof o === "object" && !Array.isArray(o)).map((o) => ({
    id: String(o.id ?? ""),
    url: String(o.url ?? ""),
    store: String(o.store ?? ""),
    price: typeof o.price === "number" ? o.price : null,
    currency: typeof o.currency === "string" ? o.currency : "EUR",
    checkedAt: typeof o.checkedAt === "string" ? o.checkedAt : null,
    error: typeof o.error === "string" ? o.error : null,
  }))
}

export function readHistory(value: Prisma.JsonValue | null): PricePoint[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((p): p is Prisma.JsonObject => !!p && typeof p === "object" && !Array.isArray(p))
    .filter((p) => typeof p.price === "number" && typeof p.date === "string")
    .map((p) => ({ date: p.date as string, price: p.price as number }))
}

export function serializeItem(item: DbItem): WishlistItem {
  return {
    id: item.id,
    listId: item.listId,
    title: item.title,
    url: item.url,
    imageUrl: item.imageUrl,
    store: item.store,
    price: item.price,
    currency: item.currency,
    quantity: item.quantity,
    notes: item.notes,
    promoCode: item.promoCode,
    offers: readOffers(item.offers),
    priceHistory: readHistory(item.priceHistory),
    lastCheckedAt: item.lastCheckedAt?.toISOString() ?? null,
    checkError: item.checkError,
    purchased: item.purchased,
    purchasedAt: item.purchasedAt?.toISOString() ?? null,
    order: item.order,
    createdAt: item.createdAt.toISOString(),
  }
}

/** Ajoute un relevé : un point par jour au plus, le dernier du jour fait foi. */
export function addPricePoint(history: PricePoint[], price: number | null, now = new Date()): PricePoint[] {
  if (price == null) return history
  const day = now.toISOString().slice(0, 10)
  const last = history[history.length - 1]
  if (last && last.date.slice(0, 10) === day) return [...history.slice(0, -1), { date: now.toISOString(), price }]
  if (last && last.price === price && history.length > 1 && history[history.length - 2].price === price) {
    // Prix inchangé : on avance le dernier point au lieu d'en empiler un nouveau
    return [...history.slice(0, -1), { date: now.toISOString(), price }]
  }
  return [...history, { date: now.toISOString(), price }].slice(-MAX_HISTORY)
}

/**
 * Relit le prix du lien principal et des autres offres, enregistre l'historique et prévient
 * (notification + push) quand le meilleur prix baisse.
 */
export async function refreshItem(item: DbItem): Promise<WishlistItem> {
  const now = new Date()
  const before = serializeItem(item)
  const data: Prisma.WishlistItemUpdateInput = { lastCheckedAt: now }

  let price = item.price
  if (item.url) {
    const result = await fetchProduct(item.url)
    if (result.ok && result.info.price != null) {
      price = result.info.price
      data.price = price
      if (result.info.currency) data.currency = result.info.currency
      if (!item.imageUrl && result.info.imageUrl) data.imageUrl = result.info.imageUrl
      data.checkError = null
    } else {
      data.checkError = result.ok ? "Prix introuvable sur la page" : result.error
    }
  }
  data.priceHistory = addPricePoint(before.priceHistory, price, now) as unknown as Prisma.InputJsonValue

  const offers: WishlistOffer[] = []
  for (const offer of before.offers) {
    const result = await fetchProduct(offer.url)
    offers.push(
      result.ok && result.info.price != null
        ? { ...offer, price: result.info.price, currency: result.info.currency || offer.currency, checkedAt: now.toISOString(), error: null }
        : { ...offer, checkedAt: now.toISOString(), error: result.ok ? "Prix introuvable sur la page" : result.error }
    )
  }
  if (offers.length) data.offers = offers as unknown as Prisma.InputJsonValue

  const updated = await prisma.wishlistItem.update({ where: { id: item.id }, data })
  const after = serializeItem(updated)
  if (!after.purchased) await notifyPriceChange(before, after).catch((error) => console.error("Wishlist alert failed:", error))
  return after
}

async function notifyPriceChange(before: WishlistItem, after: WishlistItem) {
  const was = bestOffer(before)
  const now = bestOffer(after)
  if (!now || !was || now.price >= was.price) return
  const userId = (await prisma.wishlistItem.findUnique({ where: { id: after.id }, select: { userId: true } }))?.userId
  if (!userId) return

  const where = now.store ? ` sur ${now.store}` : ""
  const title = `Baisse de prix : ${after.title}`
  const body = `${formatPrice(now.price, after.currency)}${where} (avant ${formatPrice(was.price, after.currency)})`
  const created = await createNotification({
    userId,
    type: "wishlist",
    title: title.slice(0, 160),
    body,
    link: "wishlist",
    dedupeKey: `wishlist:${after.id}:${now.price}`,
    meta: { wishlistItemId: after.id },
  })
  if (created) await sendPushToUser(userId, { title: title.slice(0, 120), body, url: "/?page=wishlist", tag: `wishlist-${after.id}` })
}

/** Actualise les articles non achetés dont le prix date de plus de 20 h (au plus 15 par passage). */
export async function refreshStaleItems(userId: string, force = false) {
  const items = await prisma.wishlistItem.findMany({
    where: {
      userId,
      purchased: false,
      AND: [
        // Seulement ce qui a un lien à relire
        { OR: [{ url: { not: null } }, { offers: { not: Prisma.DbNull } }] },
        force ? {} : { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - STALE_MS) } }] },
      ],
    },
    orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
    take: MAX_PER_RUN,
  })
  const refreshed: WishlistItem[] = []
  for (const item of items) {
    if (!item.url && !readOffers(item.offers).length) continue
    refreshed.push(await refreshItem(item))
  }
  return refreshed
}

/** À l'ouverture de la page (sans cron) : au plus une fois par heure et par utilisateur, sans attendre. */
export function maybeRefreshInBackground(userId: string) {
  if (Date.now() - (lastLazyRun.get(userId) || 0) < LAZY_MIN_GAP_MS) return
  lastLazyRun.set(userId, Date.now())
  refreshStaleItems(userId).catch((error) => console.error("Wishlist refresh failed:", error))
}

export async function refreshWishlistsForAllUsers() {
  const users = await prisma.wishlistItem.findMany({
    where: { purchased: false, url: { not: null } },
    distinct: ["userId"],
    select: { userId: true },
  })
  let refreshed = 0
  for (const { userId } of users) {
    try {
      refreshed += (await refreshStaleItems(userId)).length
    } catch (error) {
      console.error(`Wishlist refresh failed for ${userId}:`, error)
    }
  }
  return refreshed
}
