import { NextResponse } from 'next/server'
import { badRequest, getSessionUser, unauthorized } from '@/lib/projects/server'
import { isRateLimited, recordAttempt } from '@/lib/rate-limit'
import { fetchProduct } from '@/lib/wishlist/fetch-product'
import { parseHttpUrl } from '@/lib/wishlist/shared'

const LIMIT = 40
const WINDOW_MS = 10 * 60_000

// POST /api/wishlist/preview { url } — titre, prix, image et boutique lus sur la page, pour pré-remplir le formulaire
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const url = parseHttpUrl(body.url)
  if (!url) return badRequest('Lien invalide')

  const key = `wishlist-fetch:${user.id}`
  if (isRateLimited(key, LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: 'Trop de lectures de pages, réessaie dans quelques minutes' }, { status: 429 })
  }
  recordAttempt(key, WINDOW_MS)

  const result = await fetchProduct(url)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
  return NextResponse.json(result.info)
}
