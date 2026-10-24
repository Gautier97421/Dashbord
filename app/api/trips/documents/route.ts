import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { TRIP_INCLUDE, accessibleTrip, serializeTrip } from '@/lib/travel/server'

async function tripResponse(tripId: string, viewerId: string) {
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId }, include: TRIP_INCLUDE })
  return NextResponse.json({ trip: serializeTrip(trip, viewerId) })
}

async function resolve(body: { tripId?: unknown; documentId?: unknown }, userId: string) {
  const trip = await accessibleTrip(body.tripId, userId)
  const doc = typeof body.documentId === 'string' ? await prisma.travelDocument.findFirst({ where: { id: body.documentId, userId }, select: { id: true } }) : null
  return trip && doc ? { trip, doc } : null
}

// POST /api/trips/documents { tripId, documentId, shared? } — utiliser un document de ma bibliothèque pour ce voyage
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const found = await resolve(body, user.id)
  if (!found) return notFound('Voyage ou document introuvable')
  await prisma.tripDocumentLink.upsert({
    where: { tripId_documentId: { tripId: found.trip.id, documentId: found.doc.id } },
    create: { tripId: found.trip.id, documentId: found.doc.id, userId: user.id, shared: body.shared === true },
    update: {},
  })
  return tripResponse(found.trip.id, user.id)
}

// PUT /api/trips/documents { tripId, documentId, shared } — visible ou non des autres membres du voyage
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  if (typeof body.shared !== 'boolean') return badRequest('Valeur invalide')
  const found = await resolve(body, user.id)
  if (!found) return notFound('Voyage ou document introuvable')
  const { count } = await prisma.tripDocumentLink.updateMany({ where: { tripId: found.trip.id, documentId: found.doc.id, userId: user.id }, data: { shared: body.shared } })
  if (!count) return notFound('Document non utilisé pour ce voyage')
  return tripResponse(found.trip.id, user.id)
}

// DELETE /api/trips/documents?tripId=…&documentId=… — ne plus l'utiliser pour ce voyage (il reste dans la bibliothèque)
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const params = new URL(request.url).searchParams
  const found = await resolve({ tripId: params.get('tripId'), documentId: params.get('documentId') }, user.id)
  if (!found) return notFound('Voyage ou document introuvable')
  await prisma.tripDocumentLink.deleteMany({ where: { tripId: found.trip.id, documentId: found.doc.id, userId: user.id } })
  return tripResponse(found.trip.id, user.id)
}
