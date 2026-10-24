import { NextResponse } from 'next/server'
import { badRequest, getSessionUser, unauthorized } from '@/lib/projects/server'
import { isRateLimited, recordAttempt } from '@/lib/rate-limit'

// Lieux utiles autour de la zone affichée (OpenStreetMap, via l'API Overpass) : supermarchés, stations, pharmacies…
// Serveurs publics essayés dans l'ordre : ils sont parfois saturés
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const BUSY = 'Le service des lieux d’OpenStreetMap est saturé, réessaie dans un moment'
const CACHE_MS = 15 * 60_000
const MAX_SPAN = 0.35 // degrés (~35 km) : au-delà, trop de résultats
const cache = new Map<string, { at: number; results: unknown[] }>()

const POI_FILTERS: Record<string, string[]> = {
  supermarket: ['shop~"^(supermarket|convenience|greengrocer|bakery)$"'],
  fuel: ['amenity~"^(fuel|charging_station)$"'],
  pharmacy: ['amenity~"^(pharmacy|hospital|clinic|doctors)$"'],
  atm: ['amenity~"^(atm|bank|bureau_de_change)$"'],
  food: ['amenity~"^(restaurant|cafe|fast_food|bar|pub)$"'],
  transport: ['railway~"^(station|halt)$"', 'amenity~"^(bus_station|ferry_terminal|car_rental)$"', 'aeroway="aerodrome"'],
  parking: ['amenity="parking"'],
  toilets: ['amenity~"^(toilets|drinking_water)$"'],
  sights: ['tourism~"^(attraction|museum|viewpoint|gallery|zoo|theme_park)$"', 'historic~"^(castle|monument|memorial|ruins)$"'],
  lodging: ['tourism~"^(hotel|guest_house|hostel|camp_site|apartment)$"'],
}

interface OverpassElement {
  id: number
  type: string
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

// GET /api/trips/poi?kind=supermarket&south=…&west=…&north=…&east=…
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const params = new URL(request.url).searchParams
  const kind = params.get('kind') || ''
  const filters = POI_FILTERS[kind]
  if (!filters) return badRequest('Catégorie inconnue')
  const [south, west, north, east] = ['south', 'west', 'north', 'east'].map((k) => Number(params.get(k)))
  if (![south, west, north, east].every(Number.isFinite) || south >= north || west >= east) return badRequest('Zone invalide')
  if (north - south > MAX_SPAN || east - west > MAX_SPAN * 1.5) return NextResponse.json({ error: 'Zoome davantage sur la carte pour afficher ces lieux' }, { status: 422 })

  // Zone arrondie : les petits déplacements réutilisent le même résultat
  const r = (n: number) => Math.round(n * 50) / 50
  const bbox = [r(south) - 0.02, r(west) - 0.02, r(north) + 0.02, r(east) + 0.02].map((n) => n.toFixed(3)).join(',')
  const key = `${kind}:${bbox}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ results: hit.results })

  const limitKey = `trip-poi:${user.id}`
  if (isRateLimited(limitKey, 60, 10 * 60_000)) return NextResponse.json({ error: 'Trop de recherches, réessaie dans quelques minutes' }, { status: 429 })
  recordAttempt(limitKey, 10 * 60_000)

  const body = filters.flatMap((f) => [`node[${f}](${bbox});`, `way[${f}](${bbox});`]).join('')
  const query = `[out:json][timeout:8];(${body});out center 150;`
  let data: { elements?: OverpassElement[] } | null = null
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'DashLife/1.0 (tableau de bord personnel)' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(9_000),
      })
      if (res.ok) {
        data = await res.json()
        break
      }
    } catch {
      // délai dépassé ou serveur injoignable : serveur suivant
    }
  }
  if (!data) return NextResponse.json({ error: BUSY }, { status: 503 })

  try {
    const results = (data.elements || [])
      .map((e) => {
        const lat = e.lat ?? e.center?.lat
        const lng = e.lon ?? e.center?.lon
        const t = e.tags || {}
        const address = [t['addr:housenumber'], t['addr:street'], t['addr:city']].filter(Boolean).join(' ')
        return {
          id: `${e.type}/${e.id}`,
          lat,
          lng,
          name: t.name || t.brand || t.operator || null,
          type: t.shop || t.amenity || t.tourism || t.railway || t.historic || t.aeroway || null,
          address: address || null,
          hours: t.opening_hours || null,
          website: t.website || t['contact:website'] || null,
          phone: t.phone || t['contact:phone'] || null,
        }
      })
      .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
    cache.set(key, { at: Date.now(), results })
    if (cache.size > 500) cache.delete(cache.keys().next().value as string)
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: BUSY }, { status: 503 })
  }
}
