import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { removeStoredFiles } from '@/lib/projects/storage'
import { DOC_CATEGORIES } from '@/lib/travel/shared'
import { FILE_SELECT, parseFields, serializeDocument, type Spec } from '@/lib/travel/server'

const SPEC: Spec = {
  title: { type: 'text', max: 120, required: true },
  category: { type: 'enum', values: DOC_CATEGORIES.map((c) => c.value) },
  number: { type: 'text', max: 60 },
  holder: { type: 'text', max: 120 },
  issuedAt: { type: 'day' },
  expiresAt: { type: 'day' },
  notes: { type: 'long', max: 2000 },
}

const INCLUDE = { attachments: { select: FILE_SELECT, orderBy: { createdAt: 'desc' } }, links: { select: { tripId: true, shared: true } } } as const

type DbDoc = Prisma.TravelDocumentGetPayload<{ include: typeof INCLUDE }>
const out = (d: DbDoc) => ({ ...serializeDocument(d), links: d.links })

// GET /api/travel-documents — ma bibliothèque (documents privés, réutilisables d'un voyage à l'autre)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const docs = await prisma.travelDocument.findMany({ where: { userId: user.id }, include: INCLUDE, orderBy: [{ category: 'asc' }, { title: 'asc' }] })
  return NextResponse.json({ documents: docs.map(out) })
}

// POST /api/travel-documents { title, category?, number?, holder?, issuedAt?, expiresAt?, notes? }
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const parsed = parseFields(SPEC, body, false)
  if ('error' in parsed) return badRequest(parsed.error)
  if ((await prisma.travelDocument.count({ where: { userId: user.id } })) >= 200) return badRequest('Trop de documents')
  const doc = await prisma.travelDocument.create({ data: { ...(parsed.data as { title: string }), userId: user.id }, include: INCLUDE })
  return NextResponse.json({ document: out(doc) }, { status: 201 })
}

// PUT /api/travel-documents { id, …champs modifiés }
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const existing = typeof body.id === 'string' ? await prisma.travelDocument.findFirst({ where: { id: body.id, userId: user.id } }) : null
  if (!existing) return notFound('Document introuvable')
  const fields = { ...body }
  delete fields.id
  const parsed = parseFields(SPEC, fields, true)
  if ('error' in parsed) return badRequest(parsed.error)
  const doc = await prisma.travelDocument.update({ where: { id: existing.id }, data: parsed.data, include: INCLUDE })
  return NextResponse.json({ document: out(doc) })
}

// DELETE /api/travel-documents?id=… — le document, ses fichiers, et son utilisation dans tous les voyages
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const id = new URL(request.url).searchParams.get('id')
  const doc = id ? await prisma.travelDocument.findFirst({ where: { id, userId: user.id }, include: { attachments: { select: { storageKey: true } } } }) : null
  if (!doc) return notFound('Document introuvable')
  await prisma.travelDocument.delete({ where: { id: doc.id } })
  await removeStoredFiles(doc.attachments.map((a) => a.storageKey))
  return NextResponse.json({ success: true })
}
