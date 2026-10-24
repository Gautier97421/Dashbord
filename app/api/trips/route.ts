import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { removeStoredFiles } from '@/lib/projects/storage'
import { filterFriends } from '@/lib/social'
import { defaultChecklist } from '@/lib/travel/shared'
import { notifyTripShared } from '@/lib/travel/sharing'
import {
  TRIP_INCLUDE,
  TRIP_SPEC,
  accessibleTrip,
  checkDates,
  parseCategoryBudgets,
  parseContacts,
  parseFields,
  parseStops,
  parseTravelers,
  serializeTrip,
  tripAccessWhere,
} from '@/lib/travel/server'

const json = (v: unknown) => v as Prisma.InputJsonValue
// Réservé au créateur du voyage
const OWNER_FIELDS = ['cancelled', 'archived'] as const

// GET /api/trips — mes voyages et ceux partagés avec moi, avec tout leur contenu
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const trips = await prisma.trip.findMany({ where: tripAccessWhere(user.id), include: TRIP_INCLUDE, orderBy: { startDate: 'asc' } })
  return NextResponse.json({ me: user.id, trips: trips.map((t) => serializeTrip(t, user.id)) })
}

/**
 * POST /api/trips { title, destination, startDate, endDate, abroad?, currency?, budget?, travelers?, withChecklist?, shareWith? }
 *   withChecklist : checklist type datée à partir du départ ; shareWith : identifiants d'amis avec qui partager.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const parsed = parseFields(TRIP_SPEC, body, false)
  if ('error' in parsed) return badRequest(parsed.error)
  const data = parsed.data as { startDate: string; endDate: string; abroad?: boolean } & Record<string, unknown>
  const dateError = checkDates(data.startDate, data.endDate)
  if (dateError) return badRequest(dateError)
  if ((await prisma.trip.count({ where: { userId: user.id } })) >= 200) return badRequest('Trop de voyages')

  const travelers = parseTravelers(body.travelers)
  const stops = parseStops(body.stops)
  const checklist = body.withChecklist ? defaultChecklist(data.startDate, !!data.abroad) : []
  const shareWith = await filterFriends(user.id, Array.isArray(body.shareWith) ? body.shareWith.filter((v: unknown) => typeof v === 'string').slice(0, 20) : [])
  const trip = await prisma.trip.create({
    data: {
      ...(data as Prisma.TripUncheckedCreateInput),
      userId: user.id,
      travelers: travelers ? json(travelers) : undefined,
      stops: stops ? json(stops) : undefined,
      ownerShareDocs: body.shareDocs === true,
      checklist: { create: checklist.map((item, i) => ({ ...item, userId: user.id, order: i })) },
      members: { create: shareWith.map((userId) => ({ userId, addedById: user.id })) },
    },
    include: TRIP_INCLUDE,
  })
  await notifyTripShared(trip.id, user.id, shareWith)
  return NextResponse.json({ trip: serializeTrip(trip, user.id) }, { status: 201 })
}

// PUT /api/trips { id, …champs, travelers?, contacts?, categoryBudgets? } — créateur et membres
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const access = await accessibleTrip(body.id, user.id)
  if (!access) return notFound('Voyage introuvable')
  const existing = await prisma.trip.findUniqueOrThrow({ where: { id: access.id } })
  if (access.userId !== user.id && OWNER_FIELDS.some((f) => f in body)) return NextResponse.json({ error: 'Seul le créateur du voyage peut l’annuler ou l’archiver' }, { status: 403 })

  const parsed = parseFields(TRIP_SPEC, body, true)
  if ('error' in parsed) return badRequest(parsed.error)
  const data: Prisma.TripUpdateInput = parsed.data
  const dateError = checkDates((data.startDate as string) ?? existing.startDate, (data.endDate as string) ?? existing.endDate)
  if (dateError) return badRequest(dateError)

  if (body.travelers !== undefined) {
    const travelers = parseTravelers(body.travelers)
    if (!travelers) return badRequest('Voyageurs invalides')
    data.travelers = json(travelers)
  }
  if (body.stops !== undefined) {
    const stops = parseStops(body.stops)
    if (!stops) return badRequest('Destinations invalides')
    data.stops = json(stops)
  }
  if (body.contacts !== undefined) {
    const contacts = parseContacts(body.contacts)
    if (!contacts) return badRequest('Contacts invalides')
    data.contacts = json(contacts)
  }
  if (body.categoryBudgets !== undefined) {
    const budgets = parseCategoryBudgets(body.categoryBudgets)
    if (!budgets) return badRequest('Budgets invalides')
    data.categoryBudgets = json(budgets)
  }

  const trip = await prisma.trip.update({ where: { id: existing.id }, data, include: TRIP_INCLUDE })
  return NextResponse.json({ trip: serializeTrip(trip, user.id) })
}

// DELETE /api/trips?id=… — créateur seulement : le voyage, tout son contenu et ses documents
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return badRequest('ID requis')
  const trip = await prisma.trip.findFirst({ where: { id, userId: user.id }, select: { id: true } })
  if (!trip) return notFound('Voyage introuvable (seul son créateur peut le supprimer)')

  const files = await prisma.attachment.findMany({ where: { tripId: trip.id }, select: { storageKey: true } })
  await prisma.trip.delete({ where: { id: trip.id } })
  await removeStoredFiles(files.map((f) => f.storageKey))
  return NextResponse.json({ success: true })
}
