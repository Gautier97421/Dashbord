import { NextResponse } from 'next/server'
import { badRequest, getSessionUser, unauthorized } from '@/lib/projects/server'
import { CURRENCIES } from '@/lib/travel/shared'

// Taux de change du jour (Banque centrale européenne, via Frankfurter), gardés 6 h en mémoire
const CACHE_MS = 6 * 3_600_000
const cache = new Map<string, { rate: number; date: string; at: number }>()

// GET /api/trips/rate?from=USD&to=EUR — { rate, date } : 1 from = rate to
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const params = new URL(request.url).searchParams
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  if (!CURRENCIES.includes(from) || !CURRENCIES.includes(to)) return badRequest('Devise invalide')
  if (from === to) return NextResponse.json({ rate: 1, date: null })

  const key = `${from}>${to}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ rate: hit.rate, date: hit.date })

  try {
    const res = await fetch(`https://api.frankfurter.app/latest?${new URLSearchParams({ from, to })}`, { signal: AbortSignal.timeout(8000) })
    const data = (await res.json().catch(() => ({}))) as { rates?: Record<string, number>; date?: string }
    const rate = data.rates?.[to]
    if (!res.ok || typeof rate !== 'number') {
      return NextResponse.json({ error: 'Taux indisponible pour cette devise : saisis-le à la main' }, { status: 404 })
    }
    cache.set(key, { rate, date: data.date || '', at: Date.now() })
    return NextResponse.json({ rate, date: data.date || null })
  } catch {
    return NextResponse.json({ error: 'Service de taux injoignable : saisis le taux à la main' }, { status: 502 })
  }
}
