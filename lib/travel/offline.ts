// Voyages hors connexion (dans le navigateur) : dernière copie des données et documents gardés sur l'appareil.
// Le service worker (public/sw.js) sert ces documents quand le réseau manque ; tout est effacé à la déconnexion.

import type { Trip } from "@/lib/travel/shared"

const SNAPSHOT_KEY = "dashlife:travel:v1"
export const OFFLINE_DOCS = "dashlife-offline-docs"

export function saveSnapshot(trips: Trip[]) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), trips }))
  } catch {
    // stockage plein ou indisponible : le mode hors connexion ne sera simplement pas à jour
  }
}

export function loadSnapshot(): { savedAt: string; trips: Trip[] } | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!Array.isArray(data?.trips)) return null
    // Copie enregistrée par une version précédente : champs ajoutés depuis
    const trips = (data.trips as Trip[]).map((trip) => ({
      ...trip,
      ownerId: trip.ownerId ?? "",
      ownerName: trip.ownerName ?? "",
      mine: trip.mine ?? true,
      members: trip.members ?? [],
      documents: trip.documents ?? [],
      stops: trip.stops ?? [],
      shareMyDocs: trip.shareMyDocs ?? false,
    }))
    return { savedAt: data.savedAt, trips }
  } catch {
    return null
  }
}

const docUrl = (id: string) => `/api/attachments/${id}`
const hasCaches = () => typeof window !== "undefined" && "caches" in window

/** Documents déjà gardés sur l'appareil. */
export async function offlineDocIds(): Promise<Set<string>> {
  if (!hasCaches()) return new Set()
  try {
    const cache = await caches.open(OFFLINE_DOCS)
    const keys = await cache.keys()
    return new Set(keys.map((r) => new URL(r.url).pathname.split("/").pop() || ""))
  } catch {
    return new Set()
  }
}

/** Copie les documents sur l'appareil ; renvoie le nombre de documents enregistrés. */
export async function keepDocsOffline(ids: string[]): Promise<number> {
  if (!hasCaches()) return 0
  const cache = await caches.open(OFFLINE_DOCS)
  let saved = 0
  for (const id of ids) {
    try {
      const res = await fetch(docUrl(id), { credentials: "same-origin" })
      if (!res.ok) continue
      await cache.put(docUrl(id), res)
      saved++
    } catch {
      // hors connexion ou fichier disparu : on passe au suivant
    }
  }
  return saved
}

export async function dropDocOffline(id: string) {
  if (!hasCaches()) return
  try {
    await (await caches.open(OFFLINE_DOCS)).delete(docUrl(id))
  } catch {
    // rien à faire
  }
}

/** À la déconnexion : rien ne reste sur l'appareil. */
export async function clearTravelOffline() {
  try {
    localStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    // indisponible
  }
  if (hasCaches()) await caches.delete(OFFLINE_DOCS).catch(() => false)
}
