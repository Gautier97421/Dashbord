// Requêtes vers une adresse saisie par l'utilisateur (wishlist, nœud « Requête HTTP » des workflows,
// suivi de produits). Côté serveur uniquement.
//
// Le serveur ne doit pas pouvoir joindre le réseau interne (SSRF : base de données, métadonnées du VPS…).
// Seuls http(s) sur les ports standard sont acceptés, et chaque connexion passe par une résolution DNS
// qui refuse les adresses privées, locales ou réservées — y compris après une redirection, et au moment
// même de la connexion (pas de contournement par un DNS qui change de réponse).

import dns from "node:dns"
import http from "node:http"
import https from "node:https"
import net from "node:net"
import zlib from "node:zlib"
import type { Readable } from "node:stream"

// ─── Adresses autorisées ─────────────────────────────────────────────────────

function ipv4Public(ip: string) {
  const [a, b, c] = ip.split(".").map(Number)
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false // CGNAT
  if (a === 169 && b === 254) return false // lien local (dont métadonnées cloud)
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false
  if (a === 198 && (b === 18 || b === 19)) return false
  if (a === 198 && b === 51 && c === 100) return false
  if (a === 203 && b === 0 && c === 113) return false
  return true
}

/** Vrai si l'adresse IP est joignable sur Internet (ni privée, ni locale, ni réservée). */
export function isPublicIp(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]
  const family = net.isIP(ip)
  if (family === 4) return ipv4Public(ip)
  if (family !== 6) return false

  // IPv4 encapsulée (::ffff:a.b.c.d ou ::ffff:7f00:1)
  const mapped = ip.match(/^(?:0*:)*:?ffff:(.+)$/)
  if (mapped) {
    const rest = mapped[1]
    if (net.isIP(rest) === 4) return ipv4Public(rest)
    const groups = rest.split(":")
    if (groups.length === 2) {
      const hi = parseInt(groups[0], 16)
      const lo = parseInt(groups[1], 16)
      return ipv4Public(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)
    }
    return false
  }
  if (ip === "::" || ip === "::1") return false
  const first = parseInt(ip.split(":")[0] || "0", 16)
  if ((first & 0xfe00) === 0xfc00) return false // fc00::/7 (adresses uniques locales)
  if ((first & 0xffc0) === 0xfe80) return false // fe80::/10 (lien local)
  if ((first & 0xff00) === 0xff00) return false // multicast
  if (first === 0) return false // ::/16 dont IPv4 compatibles
  if (first === 0x64 || first === 0x2002) return false // NAT64, 6to4 : peuvent viser une IPv4 privée
  if (ip.startsWith("2001:db8:") || ip.startsWith("2001:0db8:")) return false
  return true
}

/** Adresse http(s) publique, ou null. */
export function publicHttpUrl(raw: string, base?: URL): URL | null {
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  if (url.username || url.password) return null
  if (url.port && url.port !== "80" && url.port !== "443") return null
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  if (!host || host === "localhost" || /\.(localhost|local|internal|lan|home\.arpa)$/.test(host)) return null
  const literal = host.replace(/^\[|\]$/g, "")
  if (net.isIP(literal) && !isPublicIp(literal)) return null
  if (!net.isIP(literal) && !host.includes(".")) return null
  return url
}

// Résolution DNS appelée par Node au moment de la connexion : refuse toute adresse non publique
export const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, family: options.family ?? 0 }, (error, addresses) => {
    if (error) return callback(error, "", 4)
    const list = addresses as dns.LookupAddress[]
    if (!list.length || list.some((a) => !isPublicIp(a.address))) {
      return callback(Object.assign(new Error("Adresse non autorisée"), { code: "EBLOCKED" }), "", 4)
    }
    if ((options as dns.LookupAllOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list)
    callback(null, list[0].address, list[0].family)
  })
}

/** Décompresse le corps selon Content-Encoding. */
export function decodedStream(res: http.IncomingMessage): Readable {
  const encoding = String(res.headers["content-encoding"] || "").toLowerCase()
  if (encoding === "gzip" || encoding === "x-gzip") return res.pipe(zlib.createGunzip())
  if (encoding === "deflate") return res.pipe(zlib.createInflate())
  if (encoding === "br") return res.pipe(zlib.createBrotliDecompress())
  return res
}

// ─── Requête générique ───────────────────────────────────────────────────────

export interface SafeRequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
  /** Taille maximale lue (le reste de la réponse est ignoré) */
  maxBytes?: number
}

export interface SafeResponse {
  status: number
  ok: boolean
  url: string
  contentType: string
  text: string
}

const MAX_REDIRECTS = 4

function requestOnce(url: URL, options: SafeRequestOptions): Promise<SafeResponse & { location?: string }> {
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http
    const req = client.request(url, { method: options.method ?? "GET", headers: options.headers, lookup: safeLookup, agent: false }, (res) => {
      const status = res.statusCode || 0
      const contentType = String(res.headers["content-type"] || "")
      const base = { status, ok: status >= 200 && status < 300, url: url.toString(), contentType }
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        return resolve({ ...base, text: "", location: res.headers.location })
      }
      const stream = decodedStream(res)
      const chunks: Buffer[] = []
      let size = 0
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve({ ...base, text: Buffer.concat(chunks).toString("utf8") })
      }
      stream.on("data", (chunk: Buffer) => {
        if (done) return
        chunks.push(chunk)
        size += chunk.length
        if (size >= maxBytes) {
          finish()
          req.destroy()
        }
      })
      stream.on("end", finish)
      stream.on("error", (error) => (size > 0 ? finish() : reject(error)))
    })
    req.setTimeout(options.timeoutMs ?? 20_000, () => req.destroy(Object.assign(new Error("Délai dépassé"), { code: "ETIMEDOUT" })))
    req.on("error", reject)
    if (options.body !== undefined) req.write(options.body)
    req.end()
  })
}

/**
 * Requête HTTP vers une adresse publique uniquement. Les redirections ne sont suivies que pour GET/HEAD
 * (une écriture n'est jamais rejouée ailleurs), chacune revérifiée.
 */
export async function safeRequest(raw: string, options: SafeRequestOptions = {}): Promise<SafeResponse> {
  let url = publicHttpUrl(raw)
  if (!url) throw Object.assign(new Error("Adresse invalide ou non autorisée (réseau interne)"), { code: "EBLOCKED" })
  const method = (options.method ?? "GET").toUpperCase()
  const follow = method === "GET" || method === "HEAD"
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await requestOnce(url, { ...options, method })
    if (!res.location || !follow) return res
    const next = publicHttpUrl(res.location, url)
    if (!next) throw Object.assign(new Error("Redirection non autorisée"), { code: "EBLOCKED" })
    url = next
  }
  throw new Error("Trop de redirections")
}
