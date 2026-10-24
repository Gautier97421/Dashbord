import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { filterFriends } from '@/lib/social'
import { notifyTripShared } from '@/lib/travel/sharing'
import { TRIP_INCLUDE, serializeTrip } from '@/lib/travel/server'

/**
 * PUT /api/trips/share { tripId, userIds } — créateur seulement : membres du voyage.
 *   Les nouveaux membres doivent être des amis ; un membre retiré perd l'accès (ses documents privés sont détachés).
 */
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const trip = typeof body.tripId === 'string' ? await prisma.trip.findFirst({ where: { id: body.tripId, userId: user.id }, include: { members: true } }) : null
  if (!trip) return notFound('Voyage introuvable (seul son créateur gère le partage)')
  if (!Array.isArray(body.userIds)) return badRequest('Liste de membres invalide')

  const wanted = [...new Set<string>(body.userIds.filter((v: unknown): v is string => typeof v === 'string' && v !== user.id))].slice(0, 20)
  const current = new Set(trip.members.map((m) => m.userId))
  const added = await filterFriends(user.id, wanted.filter((id) => !current.has(id)))
  const removed = [...current].filter((id) => !wanted.includes(id))

  await prisma.$transaction([
    prisma.tripMember.deleteMany({ where: { tripId: trip.id, userId: { in: removed } } }),
    prisma.tripDocumentLink.deleteMany({ where: { tripId: trip.id, userId: { in: removed } } }),
    prisma.tripMember.createMany({ data: added.map((userId) => ({ tripId: trip.id, userId, addedById: user.id })), skipDuplicates: true }),
  ])
  await notifyTripShared(trip.id, user.id, added)

  const fresh = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, include: TRIP_INCLUDE })
  return NextResponse.json({ trip: serializeTrip(fresh, user.id) })
}

// DELETE /api/trips/share?tripId=… — quitter un voyage partagé avec moi
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const tripId = new URL(request.url).searchParams.get('tripId')
  if (!tripId) return badRequest('Voyage requis')
  const { count } = await prisma.tripMember.deleteMany({ where: { tripId, userId: user.id } })
  if (!count) return notFound('Tu ne fais pas partie de ce voyage')
  await prisma.tripDocumentLink.deleteMany({ where: { tripId, userId: user.id } })
  return NextResponse.json({ success: true })
}
