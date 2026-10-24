// Service worker DashLife (PWA)
// - Pages : réseau d'abord, page hors-ligne en secours
// - /_next/static : cache d'abord (fichiers hashés, immuables)
// - Images / polices : stale-while-revalidate
// - /api : jamais mis en cache (données utilisateur + auth), sauf les documents de voyage que
//   l'utilisateur a choisi de garder hors connexion (copiés par la page dans OFFLINE_DOCS)
// - Accueil : dernière version gardée pour ouvrir l'app sans réseau (mode voyage)
// - Notifications push (alertes des projets) : affichage, et ouverture de l'app au clic

const VERSION = "dashlife-v5"
const STATIC_CACHE = `${VERSION}-static`
const ASSET_CACHE = `${VERSION}-assets`
const PAGE_CACHE = `${VERSION}-pages`
// Gardé d'une version à l'autre ; vidé à la déconnexion
const OFFLINE_DOCS = "dashlife-offline-docs"
const OFFLINE_URL = "/offline.html"

const PRECACHE = [
  OFFLINE_URL,
  "/favicon/android-chrome-192x192.png",
  "/favicon/android-chrome-512x512.png",
  "/favicon/maskable-192x192.png",
  "/favicon/maskable-512x512.png",
  "/favicon/apple-touch-icon.png",
  "/favicon/favicon.ico",
]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION) && k !== OFFLINE_DOCS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/attachments/")) {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .open(OFFLINE_DOCS)
          .then((cache) => cache.match(request, { ignoreSearch: true }))
          .then((hit) => hit || Response.error())
      )
    )
    return
  }
  if (url.pathname.startsWith("/api/")) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Accueil de l'app (connecté : pas de redirection vers /login) gardé pour le hors connexion
          if (url.pathname === "/" && response.ok && !response.redirected) {
            const copy = response.clone()
            caches.open(PAGE_CACHE).then((cache) => cache.put("/", copy))
          }
          return response
        })
        .catch(async () => (url.pathname === "/" && (await caches.match("/", { cacheName: PAGE_CACHE }))) || caches.match(OFFLINE_URL))
    )
    return
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  if (/\.(png|jpe?g|svg|webp|gif|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE))
  }
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "DashLife", body: event.data ? event.data.text() : "" }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "DashLife", {
      body: data.body || "",
      icon: "/favicon/android-chrome-192x192.png",
      badge: "/favicon/favicon-32x32.png",
      tag: data.tag,
      // Une alerte qui remplace la précédente (même tag) sonne quand même
      renotify: !!data.tag,
      data: { url: data.url || "/?page=projects" },
    })
  )
})

// Clic : on réutilise une fenêtre de l'app déjà ouverte, sinon on en ouvre une
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || "/", self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const client = clients.find((c) => new URL(c.url).origin === self.location.origin)
      if (client) {
        await client.focus()
        return client.navigate(target.href)
      }
      return self.clients.openWindow(target.href)
    })
  )
})

// Les fichiers de chaque nouvelle version s'ajoutent au cache : on garde les plus récents
const MAX_STATIC_ENTRIES = 300

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key)
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    await cache.put(request, response.clone())
    trimCache(cacheName, MAX_STATIC_ENTRIES)
  }
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  return cached || network
}
