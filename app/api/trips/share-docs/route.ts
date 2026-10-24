import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { TRIP_INCLUDE, accessibleTrip, serializeTrip } from '@/lib/travel/server'

/**
 * PUT /api/trips/share-docs { tripId, shareDocs } — montrer (ou non) aux autres membres tous mes documents
 *   liés à ce voyage. Réglage personnel : chacun décide pour ses propres documents.
 */
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  if (typeof body.shareDocs !== 'boolean') return badRequest('Valeur invalide')
  const trip = await accessibleTrip(body.tripId, user.id)
  if (!trip) return notFound('Voyage introuvable')

  if (trip.userId === user.id) {
    await prisma.trip.update({ where: { id: trip.id }, data: { ownerShareDocs: body.shareDocs } })
  } else {
    await prisma.tripMember.updateMany({ where: { tripId: trip.id, userId: user.id }, data: { shareDocs: body.shareDocs } })
  }
  // Désactivé : chaque document redevient privé, sauf ceux rendus visibles un par un ensuite
  if (!body.shareDocs) await prisma.tripDocumentLink.updateMany({ where: { tripId: trip.id, userId: user.id }, data: { shared: false } })

  const fresh = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, include: TRIP_INCLUDE })
  return NextResponse.json({ trip: serializeTrip(fresh, user.id) })
}
