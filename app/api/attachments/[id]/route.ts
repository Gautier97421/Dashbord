import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { INLINE_MIME_TYPES, readStoredFile, removeStoredFiles } from '@/lib/projects/storage'
import { accessibleTrip, tripAccessWhere } from '@/lib/travel/server'

type Params = { params: Promise<{ id: string }> }

type Row = { userId: string; tripId: string | null; travelDocId: string | null }

// Lecture : mes fichiers, ceux des voyages partagés avec moi, et les documents qu'un membre a partagés pour un voyage commun
async function canRead(file: Row, userId: string) {
  if (file.userId === userId) return true
  if (file.tripId) return !!(await accessibleTrip(file.tripId, userId))
  if (file.travelDocId) {
    // Document partagé seul, ou son propriétaire montre tous ses documents du voyage (même règle que serializeTrip)
    const doc = await prisma.travelDocument.findUnique({ where: { id: file.travelDocId }, select: { userId: true } })
    if (!doc) return false
    return !!(await prisma.tripDocumentLink.findFirst({
      where: {
        documentId: file.travelDocId,
        trip: tripAccessWhere(userId),
        OR: [
          { shared: true },
          { trip: { userId: doc.userId, ownerShareDocs: true } },
          { trip: { members: { some: { userId: doc.userId, shareDocs: true } } } },
        ],
      },
      select: { id: true },
    }))
  }
  return false
}

// Suppression : l'auteur du fichier, ou le créateur du voyage pour les fichiers du voyage
async function canDelete(file: Row, userId: string) {
  if (file.userId === userId) return true
  if (!file.tripId) return false
  return !!(await prisma.trip.findFirst({ where: { id: file.tripId, userId }, select: { id: true } }))
}

// GET /api/attachments/[id] — contenu du fichier (?download=1 force le téléchargement)
export async function GET(request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const { id } = await params

  const attachment = await prisma.attachment.findUnique({ where: { id } })
  if (!attachment || !(await canRead(attachment, user.id))) return notFound('File not found')

  let data: Buffer
  try {
    data = await readStoredFile(attachment.storageKey)
  } catch {
    return notFound('Le fichier n’est plus disponible sur le serveur')
  }

  const forceDownload = new URL(request.url).searchParams.get('download') === '1'
  const inline = !forceDownload && INLINE_MIME_TYPES.has(attachment.mimeType)
  const encodedName = encodeURIComponent(attachment.name)
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': inline ? attachment.mimeType : 'application/octet-stream',
      'Content-Length': String(data.length),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodedName}`,
      'X-Content-Type-Options': 'nosniff',
      // Politique de sécurité "sandbox" : définie dans next.config.mjs (elle y remplacerait celle-ci)
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

// DELETE /api/attachments/[id]
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const { id } = await params

  const attachment = await prisma.attachment.findUnique({ where: { id } })
  if (!attachment || !(await canDelete(attachment, user.id))) return notFound('File not found')

  await prisma.attachment.delete({ where: { id } })
  await removeStoredFiles([attachment.storageKey])
  return NextResponse.json({ success: true })
}
