import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, unauthorized } from '@/lib/projects/server'
import { isPushConfigured, vapidPublicKey } from '@/lib/push'
import { getAlertPrefs, mergeAlertPrefs, saveAlertPrefs } from '@/lib/projects/alert-prefs'

/**
 * GET    /api/push — clé publique VAPID et nombre d'appareils abonnés
 * POST   /api/push { subscription, timeZone? } — abonne cet appareil
 * DELETE /api/push { endpoint } — désabonne cet appareil
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const devices = await prisma.pushSubscription.count({ where: { userId: user.id } })
  return NextResponse.json({ configured: isPushConfigured(), publicKey: vapidPublicKey(), devices })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPushConfigured()) return NextResponse.json({ error: 'Push non configuré sur le serveur (clés VAPID)' }, { status: 503 })

  const body = await request.json()
  const sub = body.subscription
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : ''
  const p256dh = sub?.keys?.p256dh
  const auth = sub?.keys?.auth
  if (!endpoint.startsWith('https://') || endpoint.length > 1000 || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return badRequest('Invalid subscription')
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 300) || null
  // Un même appareil peut changer de compte : l'abonnement suit le dernier utilisateur connecté
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh, auth, userAgent },
    create: { userId: user.id, endpoint, p256dh, auth, userAgent },
  })

  if (body.timeZone) {
    const prefs = await getAlertPrefs(user.id)
    await saveAlertPrefs(user.id, mergeAlertPrefs(prefs, { timeZone: body.timeZone, push: true }))
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  if (typeof body.endpoint !== 'string') return badRequest('Endpoint is required')
  await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint: body.endpoint } })
  return NextResponse.json({ success: true })
}
