import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { removeStoredFiles } from '@/lib/projects/storage'
import { COLLECTION_LIMIT, COLLECTION_SPECS, TRIP_INCLUDE, accessibleTrip, delegateFor, isCollection, parseFields, serializeTrip, tripAccessWhere } from '@/lib/travel/server'

// Les écritures renvoient le voyage complet : l'interface garde une seule source de vérité
async function tripResponse(tripId: string, viewerId: string, status = 200) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: TRIP_INCLUDE })
  return NextResponse.json({ trip: trip && serializeTrip(trip, viewerId) }, { status })
}

// Élément d'un voyage accessible (créé par moi ou par un autre membre)
const itemWhere = (id: string, userId: string) => ({ id, trip: tripAccessWhere(userId) })

const toDb = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, k === 'splitWith' ? (v as Prisma.InputJsonValue) : v]))

/** POST /api/trips/items { tripId, collection, …champs } — collection : places, activities, bookings, expenses, checklist, journal */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const collection: unknown = body.collection
  if (!isCollection(collection)) return badRequest('Collection invalide')
  const trip = await accessibleTrip(body.tripId, user.id)
  if (!trip) return notFound('Voyage introuvable')

  const parsed = parseFields(COLLECTION_SPECS[collection], body, false)
  if ('error' in parsed) return badRequest(parsed.error)
  const delegate = delegateFor(collection)
  if ((await delegate.count({ where: { tripId: trip.id } })) >= COLLECTION_LIMIT) return badRequest('Trop d’éléments dans ce voyage')

  await delegate.create({ data: { ...toDb(parsed.data), userId: user.id, tripId: trip.id } })
  return tripResponse(trip.id, user.id, 201)
}

// PUT /api/trips/items { collection, id, …champs modifiés }
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const collection: unknown = body.collection
  if (!isCollection(collection)) return badRequest('Collection invalide')
  const delegate = delegateFor(collection)
  const existing = typeof body.id === 'string' ? await delegate.findFirst({ where: itemWhere(body.id, user.id) }) : null
  if (!existing) return notFound('Élément introuvable')

  const fields = { ...body }
  delete fields.id
  delete fields.tripId
  const parsed = parseFields(COLLECTION_SPECS[collection], fields, true)
  if ('error' in parsed) return badRequest(parsed.error)
  await delegate.update({ where: { id: existing.id as string }, data: toDb(parsed.data) })
  return tripResponse(existing.tripId as string, user.id)
}

// DELETE /api/trips/items?collection=…&id=… — avec ses documents
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const params = new URL(request.url).searchParams
  const collection = params.get('collection')
  const id = params.get('id')
  if (!isCollection(collection) || !id) return badRequest('Collection et ID requis')
  const delegate = delegateFor(collection)
  const existing = await delegate.findFirst({ where: itemWhere(id, user.id) })
  if (!existing) return notFound('Élément introuvable')

  const files = await prisma.attachment.findMany({ where: { tripId: existing.tripId as string, tripItemId: id }, select: { id: true, storageKey: true } })
  await prisma.attachment.deleteMany({ where: { id: { in: files.map((f) => f.id) } } })
  await delegate.deleteMany({ where: { id } })
  await removeStoredFiles(files.map((f) => f.storageKey))
  return tripResponse(existing.tripId as string, user.id)
}
