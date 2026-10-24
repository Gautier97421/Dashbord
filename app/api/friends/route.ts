import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { createNotification } from '@/lib/notifications'
import { sendPushToUser } from '@/lib/push'
import { isRateLimited, recordAttempt } from '@/lib/rate-limit'
import { displayName, listFriends, normalizeUsername, publicUser, userSelect } from '@/lib/social'

// Réponse identique que le compte existe ou non : on ne peut pas sonder quelles adresses sont inscrites
const SENT = { ok: true, message: 'Si un compte existe avec cette adresse, ta demande lui a été envoyée.' }

// GET /api/friends — amis, demandes reçues et envoyées
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const [friends, pending] = await Promise.all([
    listFriends(user.id),
    prisma.friendship.findMany({
      where: { status: 'pending', OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: { requester: { select: userSelect }, addressee: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  return NextResponse.json({
    friends,
    incoming: pending.filter((f) => f.addresseeId === user.id).map((f) => ({ id: f.id, user: publicUser(f.requester), createdAt: f.createdAt })),
    outgoing: pending.filter((f) => f.requesterId === user.id).map((f) => ({ id: f.id, user: publicUser(f.addressee), createdAt: f.createdAt })),
  })
}

/**
 * POST /api/friends { query } — demande d'ami par pseudo (« @pseudo » ou « pseudo ») ou par e-mail.
 *   Par pseudo : on sait si le compte existe (le pseudo est public). Par e-mail : réponse identique dans tous les cas.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const query = typeof body.query === 'string' ? body.query.trim() : typeof body.email === 'string' ? body.email.trim() : ''
  const byEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query)
  const email = byEmail ? query.toLowerCase() : ''
  const username = byEmail ? null : normalizeUsername(query)
  if (!byEmail && !username) return badRequest('Saisis un pseudo (3 à 20 caractères) ou une adresse e-mail')
  if (byEmail && email.length > 200) return badRequest('Adresse e-mail invalide')

  const key = `friend-request:${user.id}`
  if (isRateLimited(key, 20, 3_600_000)) return NextResponse.json({ error: 'Trop de demandes, réessaie plus tard' }, { status: 429 })
  recordAttempt(key, 3_600_000)

  const target = byEmail
    ? await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: userSelect })
    : await prisma.user.findUnique({ where: { username: username as string }, select: userSelect })
  if (target?.id === user.id) return badRequest('Tu ne peux pas t’ajouter toi-même')
  if (!target) return byEmail ? NextResponse.json(SENT) : notFound(`Aucun compte avec le pseudo @${username}`)
  const sent = byEmail ? SENT : { ok: true, message: `Demande envoyée à @${target.username}.` }

  const existing = await prisma.friendship.findFirst({
    where: { OR: [{ requesterId: user.id, addresseeId: target.id }, { requesterId: target.id, addresseeId: user.id }] },
  })
  if (existing) {
    // Il m'avait déjà fait une demande : la mienne vaut acceptation
    if (existing.status === 'pending' && existing.addresseeId === user.id) {
      await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'accepted', respondedAt: new Date() } })
      await notifyAccepted(target.id, user.id)
      return NextResponse.json({ ok: true, message: byEmail ? SENT.message : `Vous êtes maintenant amis avec @${target.username}.` })
    }
    if (byEmail) return NextResponse.json(SENT)
    return NextResponse.json({ ok: true, message: existing.status === 'accepted' ? `Vous êtes déjà amis avec @${target.username}.` : 'Demande déjà envoyée.' })
  }

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: userSelect })
  const friendship = await prisma.friendship.create({ data: { requesterId: user.id, addresseeId: target.id } })
  const name = me ? `${displayName(me)}${me.username ? ` (@${me.username})` : ''}` : 'Quelqu’un'
  const created = await createNotification({
    userId: target.id,
    type: 'social',
    title: 'Nouvelle demande d’ami',
    body: `${name} veut t’ajouter en ami pour partager des voyages.`,
    dedupeKey: `friend-request:${friendship.id}`,
    meta: { kind: 'friend-request' },
  })
  if (created) await sendPushToUser(target.id, { title: 'Nouvelle demande d’ami', body: `${name} veut t’ajouter en ami`, url: '/?social=1', tag: `friend-${friendship.id}` })
  return NextResponse.json(sent)
}

async function notifyAccepted(requesterId: string, accepterId: string) {
  const accepter = await prisma.user.findUnique({ where: { id: accepterId }, select: userSelect })
  const name = accepter ? displayName(accepter) : 'Ton ami'
  await createNotification({
    userId: requesterId,
    type: 'social',
    title: 'Demande d’ami acceptée',
    body: `${name} a accepté ta demande : vous pouvez partager vos voyages.`,
    dedupeKey: `friend-accepted:${requesterId}:${accepterId}`,
    meta: { kind: 'friend-accepted' },
  })
}

// PUT /api/friends { id, action: 'accept' | 'decline' } — réponse à une demande reçue
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const friendship = typeof body.id === 'string' ? await prisma.friendship.findFirst({ where: { id: body.id, addresseeId: user.id, status: 'pending' } }) : null
  if (!friendship) return notFound('Demande introuvable')

  if (body.action === 'accept') {
    await prisma.friendship.update({ where: { id: friendship.id }, data: { status: 'accepted', respondedAt: new Date() } })
    await notifyAccepted(friendship.requesterId, user.id)
  } else if (body.action === 'decline') {
    await prisma.friendship.delete({ where: { id: friendship.id } })
  } else {
    return badRequest('Action invalide')
  }
  return NextResponse.json({ success: true })
}

// DELETE /api/friends?id=… — annuler une demande envoyée ou retirer un ami (les voyages déjà partagés restent partagés)
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return badRequest('ID requis')
  const { count } = await prisma.friendship.deleteMany({ where: { id, OR: [{ requesterId: user.id }, { addresseeId: user.id }] } })
  if (!count) return notFound('Introuvable')
  return NextResponse.json({ success: true })
}
