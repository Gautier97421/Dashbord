import { NextResponse } from 'next/server'
import { badRequest, getSessionUser, unauthorized } from '@/lib/projects/server'
import { isRateLimited, recordAttempt } from '@/lib/rate-limit'

// Recherche d'adresse via Nominatim (OpenStreetMap). Leur règle d'usage : 1 requête par seconde au plus,
// avec un User-Agent identifiable ; l'adresse n'est envoyée que lorsque l'utilisateur clique sur « Localiser ».
const ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const REVERSE = 'https://nominatim.openstreetmap.org/reverse'
const HEADERS = { 'User-Agent': 'DashLife/1.0 (tableau de bord personnel)' }
let lastCall = 0

// Nominatim : une requête par seconde au plus, pour toute l'app
async function politeWait() {
  const wait = lastCall + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
}

async function reverse(userId: string, lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return badRequest('Coordonnées invalides')
  const key = `trip-geocode:${userId}`
  if (isRateLimited(key, 60, 10 * 60_000)) return NextResponse.json({ error: 'Trop de recherches, réessaie dans quelques minutes' }, { status: 429 })
  recordAttempt(key, 10 * 60_000)
  await politeWait()
  try {
    const url = `${REVERSE}?${new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '18', 'accept-language': 'fr' })}`
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return NextResponse.json({ error: 'Service de cartes indisponible' }, { status: 502 })
    const data = (await res.json()) as { name?: string; display_name?: string }
    return NextResponse.json({ name: data.name || null, address: data.display_name || null })
  } catch {
    return NextResponse.json({ error: 'Service de cartes injoignable' }, { status: 502 })
  }
}

/**
 * GET /api/trips/geocode?q=adresse — jusqu'à 5 résultats { name, lat, lng }
 * GET /api/trips/geocode?lat=…&lng=… — adresse du point cliqué sur la carte { name, address }
 */
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const params = new URL(request.url).searchParams
  if (params.has('lat') && params.has('lng')) return reverse(user.id, Number(params.get('lat')), Number(params.get('lng')))
  const q = (params.get('q') || '').trim().slice(0, 300)
  if (q.length < 3) return badRequest('Adresse trop courte')

  const key = `trip-geocode:${user.id}`
  if (isRateLimited(key, 60, 10 * 60_000)) return NextResponse.json({ error: 'Trop de recherches, réessaie dans quelques minutes' }, { status: 429 })
  recordAttempt(key, 10 * 60_000)

  await politeWait()

  try {
    const url = `${ENDPOINT}?${new URLSearchParams({ q, format: 'jsonv2', limit: '5', 'accept-language': 'fr' })}`
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return NextResponse.json({ error: 'Service de cartes indisponible' }, { status: 502 })
    const data = (await res.json()) as { display_name?: string; lat?: string; lon?: string }[]
    const results = data
      .map((r) => ({ name: String(r.display_name || ''), lat: Number(r.lat), lng: Number(r.lon) }))
      .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng))
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: 'Service de cartes injoignable' }, { status: 502 })
  }
}
