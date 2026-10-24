import { NextResponse } from 'next/server'
import { getSessionUser, unauthorized } from '@/lib/projects/server'
import { isPushConfigured, sendPushToUser } from '@/lib/push'

// POST /api/push/test — envoie une notification d'essai à tous les appareils de l'utilisateur
export async function POST() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPushConfigured()) return NextResponse.json({ error: 'Push non configuré sur le serveur (clés VAPID)' }, { status: 503 })

  const sent = await sendPushToUser(user.id, {
    title: 'Notifications activées',
    body: 'Tu recevras ici les alertes de tes projets et tâches.',
    url: '/?page=projects&view=overview',
    tag: 'push-test',
  })
  return NextResponse.json({ sent })
}
