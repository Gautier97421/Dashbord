// Wishlist : types et utilitaires partagés entre le serveur et l'interface.

export interface WishlistOffer {
  id: string
  url: string
  store: string
  price: number | null
  currency: string
  checkedAt: string | null
  error: string | null
}

export interface PricePoint {
  date: string
  price: number
}

export interface WishlistList {
  id: string
  name: string
  order: number
}

export interface WishlistItem {
  id: string
  listId: string | null
  title: string
  url: string | null
  imageUrl: string | null
  store: string | null
  price: number | null
  currency: string
  quantity: number
  notes: string | null
  promoCode: string | null
  offers: WishlistOffer[]
  priceHistory: PricePoint[]
  lastCheckedAt: string | null
  checkError: string | null
  purchased: boolean
  purchasedAt: string | null
  order: number
  createdAt: string
}

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"] as const

export const MAX_OFFERS = 8
export const MAX_HISTORY = 90

/**
 * Prix lu dans un texte : « 1 299,99 € », « 1.299,99 », « $1,299.99 », « 12.5 »… ; null si absent ou aberrant.
 * Le dernier séparateur suivi de 1 ou 2 chiffres est la virgule décimale.
 */
export function parsePrice(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) && input >= 0 && input < 10_000_000 ? Math.round(input * 100) / 100 : null
  if (typeof input !== "string") return null
  const raw = input.replace(/[\s  ]/g, "").match(/\d[\d.,']*/)?.[0]
  if (!raw) return null
  const lastSep = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."))
  let normalized: string
  if (lastSep >= 0 && raw.length - lastSep - 1 <= 2 && raw.length - lastSep - 1 > 0) {
    normalized = raw.slice(0, lastSep).replace(/[.,']/g, "") + "." + raw.slice(lastSep + 1)
  } else {
    normalized = raw.replace(/[.,']/g, "")
  }
  return parsePrice(Number(normalized))
}

export function formatPrice(value: number, currency = "EUR") {
  try {
    return value.toLocaleString("fr-FR", { style: "currency", currency, minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

/** Meilleure offre connue (lien principal compris), dans la devise de l'article. */
export function bestOffer(item: Pick<WishlistItem, "price" | "currency" | "store" | "url" | "offers">) {
  let best: { price: number; store: string | null; url: string | null; main: boolean } | null =
    item.price != null ? { price: item.price, store: item.store, url: item.url, main: true } : null
  for (const offer of item.offers) {
    if (offer.price == null || offer.currency !== item.currency) continue
    if (!best || offer.price < best.price) best = { price: offer.price, store: offer.store, url: offer.url, main: false }
  }
  return best
}

/** Variation depuis le premier relevé, en % (négatif = baisse). */
export function priceTrend(history: PricePoint[], current: number | null) {
  if (current == null || history.length < 2) return null
  const first = history[0].price
  if (!first) return null
  const pct = ((current - first) / first) * 100
  return Math.abs(pct) < 0.5 ? null : Math.round(pct)
}

// Requête de recherche tirée du titre : sans le nom de la boutique ajouté en fin (« … | Fnac »)
export function searchQuery(title: string) {
  const base = title.split(/\s[|–—]\s|\s-\s(?=[^-]*$)/)[0] || title
  return base.replace(/[^\p{L}\p{N}\s'+.-]/gu, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 10).join(" ")
}

export interface SearchSite {
  name: string
  url: (query: string) => string
}

const q = encodeURIComponent

// Comparer : la recherche du produit sur d'autres plateformes (nouvel onglet)
export const COMPARE_SITES: SearchSite[] = [
  { name: "Google Shopping", url: (s) => `https://www.google.com/search?tbm=shop&q=${q(s)}` },
  { name: "idealo", url: (s) => `https://www.idealo.fr/prechcat.html?q=${q(s)}` },
  { name: "Le Dénicheur", url: (s) => `https://ledenicheur.fr/search?search=${q(s)}` },
  { name: "Amazon", url: (s) => `https://www.amazon.fr/s?k=${q(s)}` },
  { name: "Cdiscount", url: (s) => `https://www.cdiscount.com/search/10/${q(s.replace(/\//g, " "))}.html` },
  { name: "Fnac", url: (s) => `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${q(s)}` },
  { name: "Rakuten", url: (s) => `https://fr.shopping.rakuten.com/search/${q(s.replace(/\//g, " "))}` },
  { name: "eBay", url: (s) => `https://www.ebay.fr/sch/i.html?_nkw=${q(s)}` },
  { name: "Leboncoin", url: (s) => `https://www.leboncoin.fr/recherche?text=${q(s)}` },
  { name: "Back Market", url: (s) => `https://www.backmarket.fr/fr-fr/search?q=${q(s)}` },
]

// Codes promo : recherches par boutique (et bons plans du produit)
export function promoLinks(store: string | null, title: string) {
  const shop = (store || "").replace(/\.(fr|com|de|es|it|co\.uk|eu)$/i, "").trim()
  const links: { name: string; url: string }[] = []
  if (shop) {
    links.push({ name: `Codes promo ${shop} (Dealabs)`, url: `https://www.dealabs.com/search?q=${q(`code promo ${shop}`)}` })
    links.push({ name: `Codes promo ${shop} (Google)`, url: `https://www.google.com/search?q=${q(`code promo ${shop}`)}` })
  }
  links.push({ name: "Bons plans du produit (Dealabs)", url: `https://www.dealabs.com/search?q=${q(searchQuery(title))}` })
  return links
}

/** Lien http(s) : null si absent ou vide, undefined si invalide. */
export function parseHttpUrl(v: unknown): string | null | undefined {
  if (v === undefined || v === null || v === "") return null
  if (typeof v !== "string") return undefined
  try {
    const url = new URL(v.trim())
    return (url.protocol === "http:" || url.protocol === "https:") && url.href.length <= 2000 ? url.href : undefined
  } catch {
    return undefined
  }
}

export const hostOf = (url: string | null) => {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^(www|m|fr|shop|store)\./, "")
  } catch {
    return null
  }
}
