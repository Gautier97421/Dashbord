// Lecture d'une page produit (titre, prix, image, boutique) pour la Wishlist. Côté serveur uniquement.
//
// L'adresse vient de l'utilisateur : protections contre le SSRF dans lib/security/safe-fetch.ts.

import http from "node:http"
import https from "node:https"
import { decodedStream, publicHttpUrl as checkUrl, safeLookup } from "@/lib/security/safe-fetch"
import { parsePrice } from "@/lib/wishlist/shared"

const TIMEOUT_MS = 10_000
const MAX_BYTES = 3 * 1024 * 1024
const MAX_REDIRECTS = 4
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

export interface ProductInfo {
  title: string | null
  price: number | null
  currency: string | null
  imageUrl: string | null
  store: string
  // Adresse finale, après redirections
  url: string
}

export type FetchResult = { ok: true; info: ProductInfo } | { ok: false; error: string }

// ─── Téléchargement ──────────────────────────────────────────────────────────

interface Page {
  status: number
  url: URL
  html: string
}

function decodeBody(buffer: Buffer, contentType: string) {
  const declared =
    contentType.match(/charset=["']?([\w-]+)/i)?.[1] ||
    buffer.subarray(0, 4096).toString("latin1").match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ||
    "utf-8"
  try {
    return new TextDecoder(declared.toLowerCase()).decode(buffer)
  } catch {
    return buffer.toString("utf8")
  }
}

function requestOnce(url: URL): Promise<{ status: number; location?: string; html: string }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http
    const req = client.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        agent: false,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode || 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          return resolve({ status, location: res.headers.location, html: "" })
        }
        const contentType = String(res.headers["content-type"] || "")
        if (!/html|xml/i.test(contentType)) {
          res.resume()
          return resolve({ status, html: "" })
        }
        const stream = decodedStream(res)

        const chunks: Buffer[] = []
        let size = 0
        let done = false
        const finish = () => {
          if (done) return
          done = true
          resolve({ status, html: decodeBody(Buffer.concat(chunks), contentType) })
        }
        stream.on("data", (chunk: Buffer) => {
          if (done) return
          chunks.push(chunk)
          size += chunk.length
          // Page trop lourde : le début suffit (balises meta et données structurées)
          if (size >= MAX_BYTES) {
            finish()
            req.destroy()
          }
        })
        stream.on("end", finish)
        stream.on("error", (error) => (size > 0 ? finish() : reject(error)))
      }
    )
    req.setTimeout(TIMEOUT_MS, () => req.destroy(Object.assign(new Error("Délai dépassé"), { code: "ETIMEDOUT" })))
    req.on("error", reject)
    req.end()
  })
}

/** Page HTML d'une adresse publique (redirections suivies et revérifiées). */
export async function fetchPage(raw: string): Promise<Page> {
  let url = checkUrl(raw)
  if (!url) throw Object.assign(new Error("Lien invalide ou non autorisé"), { code: "EBLOCKED" })
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await requestOnce(url)
    if (!res.location) return { status: res.status, url, html: res.html }
    const next = checkUrl(res.location, url)
    if (!next) throw Object.assign(new Error("Redirection non autorisée"), { code: "EBLOCKED" })
    url = next
  }
  throw new Error("Trop de redirections")
}

// ─── Lecture de la page ──────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", pound: "£",
  eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô",
  ucirc: "û", ugrave: "ù", icirc: "î", iuml: "ï", euml: "ë", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—", hellip: "…",
}

function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

const clean = (text: unknown, max = 200) =>
  typeof text === "string" ? decodeEntities(text).replace(/\s+/g, " ").trim().slice(0, max) || null : null

function metaTags(html: string) {
  const map = new Map<string, string>()
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {}
    for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? ""
    const key = (attrs.property || attrs.name || attrs.itemprop || "").toLowerCase()
    if (key && attrs.content !== undefined && !map.has(key)) map.set(key, attrs.content)
  }
  return map
}

type Json = Record<string, unknown>

// Premier objet de type Product (ou groupe de variantes) dans les données structurées JSON-LD
function findProduct(node: unknown, depth = 0): Json | null {
  if (!node || typeof node !== "object" || depth > 8) return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProduct(child, depth + 1)
      if (found) return found
    }
    return null
  }
  const obj = node as Json
  const type = obj["@type"]
  const types = (Array.isArray(type) ? type : [type]).map(String)
  if (types.some((t) => t === "Product" || t === "ProductGroup" || t.endsWith("/Product"))) return obj
  for (const key of ["@graph", "mainEntity", "itemListElement", "item"]) {
    const found = findProduct(obj[key], depth + 1)
    if (found) return found
  }
  return null
}

function offerPrice(offers: unknown, depth = 0): { price: number | null; currency: string | null } {
  if (!offers || depth > 4) return { price: null, currency: null }
  const list = Array.isArray(offers) ? offers : [offers]
  let best: { price: number | null; currency: string | null } = { price: null, currency: null }
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue
    const o = raw as Json
    const spec = (Array.isArray(o.priceSpecification) ? o.priceSpecification[0] : o.priceSpecification) as Json | undefined
    const price = parsePrice(o.price ?? o.lowPrice ?? spec?.price)
    const currency = clean(o.priceCurrency ?? spec?.priceCurrency, 3)
    const nested = price == null && o.offers ? offerPrice(o.offers, depth + 1) : null
    const candidate = nested ?? { price, currency }
    if (candidate.price != null && (best.price == null || candidate.price < best.price)) best = candidate
  }
  return best
}

function imageOf(value: unknown): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return imageOf(value[0])
  if (value && typeof value === "object") return imageOf((value as Json).url ?? (value as Json).contentUrl)
  return null
}

// Image affichée dans l'app : https uniquement (contenu mixte sinon)
function safeImage(raw: string | null, base: URL) {
  if (!raw) return null
  try {
    const url = new URL(decodeEntities(raw.trim()), base)
    if (url.protocol === "http:") url.protocol = "https:"
    return url.protocol === "https:" && url.href.length <= 2000 ? url.href : null
  } catch {
    return null
  }
}

export const storeFromHost = (host: string) => host.toLowerCase().replace(/^(www|m|fr|shop|store)\./, "")

export function extractProduct(html: string, pageUrl: URL): ProductInfo {
  let product: Json | null = null
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, ""))
      product = findProduct(data)
      if (product) break
    } catch {
      // JSON-LD mal formé : on essaie le suivant
    }
  }
  const meta = metaTags(html)

  let { price, currency } = product
    ? offerPrice(product.offers ?? (Array.isArray(product.hasVariant) ? (product.hasVariant as Json[]).flatMap((v) => v?.offers ?? []) : undefined))
    : { price: null as number | null, currency: null as string | null }
  if (price == null) {
    price = parsePrice(
      meta.get("product:price:amount") ?? meta.get("og:price:amount") ?? meta.get("price")
    )
    currency = currency ?? clean(meta.get("product:price:currency") ?? meta.get("og:price:currency") ?? meta.get("pricecurrency"), 3)
  }
  if (price == null) {
    // Microdonnées sur un autre élément que <meta>, puis prix affiché (Amazon)
    const itemprop =
      html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
      html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i)?.[1]
    price = parsePrice(itemprop) ?? parsePrice(clean(html.match(/class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)</i)?.[1]))
  }

  const host = pageUrl.hostname
  const title =
    clean(product?.name) ??
    clean(meta.get("og:title")) ??
    clean(meta.get("twitter:title")) ??
    clean(html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)</i)?.[1]) ??
    clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

  return {
    title,
    price,
    currency: currency && /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : price != null ? "EUR" : null,
    imageUrl: safeImage(imageOf(product?.image) ?? meta.get("og:image") ?? meta.get("twitter:image") ?? null, pageUrl),
    store: clean(meta.get("og:site_name"), 60) ?? storeFromHost(host),
    url: pageUrl.href,
  }
}

/** Télécharge et lit une page produit ; ne lève jamais d'exception. */
export async function fetchProduct(raw: string): Promise<FetchResult> {
  try {
    const page = await fetchPage(raw)
    if (page.status >= 400) {
      return {
        ok: false,
        error:
          page.status === 403 || page.status === 429 || page.status === 503
            ? `Le site bloque la lecture automatique (code ${page.status}) : saisis le prix à la main`
            : `Page inaccessible (code ${page.status})`,
      }
    }
    if (!page.html) return { ok: false, error: "Ce lien n'est pas une page web" }
    const info = extractProduct(page.html, page.url)
    if (!info.title && info.price == null) return { ok: false, error: "Aucune information produit trouvée sur la page" }
    return { ok: true, info }
  } catch (error) {
    const code = (error as { code?: string }).code
    const message =
      code === "EBLOCKED"
        ? (error as Error).message
        : code === "ETIMEDOUT"
          ? "Le site met trop de temps à répondre"
          : code === "ENOTFOUND"
            ? "Site introuvable"
            : "Impossible de lire la page"
    return { ok: false, error: message }
  }
}
