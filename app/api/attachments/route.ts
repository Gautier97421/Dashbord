import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, notFound, unauthorized } from '@/lib/projects/server'
import { accessibleTrip } from '@/lib/travel/server'
import { MAX_ATTACHMENT_BYTES, MAX_USER_STORAGE_BYTES, removeStoredFiles, storeFile } from '@/lib/projects/storage'

const publicFields = { id: true, name: true, mimeType: true, size: true, createdAt: true, projectId: true, taskId: true, tripId: true, tripItemId: true, travelDocId: true } as const

// GET /api/attachments?projectId=… | ?taskId=…
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const params = new URL(request.url).searchParams
  const projectId = params.get('projectId')
  const taskId = params.get('taskId')
  if (!projectId && !taskId) return badRequest('Project or task is required')

  const files = await prisma.attachment.findMany({
    where: { userId: user.id, ...(taskId ? { taskId } : { projectId, taskId: null }) },
    orderBy: { createdAt: 'desc' },
    select: publicFields,
  })
  return NextResponse.json(files)
}

// POST /api/attachments (multipart : file + projectId | taskId | noteId | tripId [+ tripItemId] | travelDocId)
export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return badRequest('File is required')
    if (file.size > MAX_ATTACHMENT_BYTES) return badRequest('Fichier trop volumineux (10 Mo maximum)')

    const used = await prisma.attachment.aggregate({ where: { userId: user.id }, _sum: { size: true } })
    if ((used._sum.size ?? 0) + file.size > MAX_USER_STORAGE_BYTES) return badRequest('Espace de stockage plein (500 Mo)')

    const field = (name: string) => (typeof form.get(name) === 'string' && form.get(name) ? (form.get(name) as string) : null)
    const taskId = field('taskId')
    const projectId = field('projectId')
    const noteId = field('noteId')
    const tripId = field('tripId')
    const travelDocId = field('travelDocId')
    let tripItemId: string | null = null
    if (taskId) {
      if (!(await prisma.task.findFirst({ where: { id: taskId, userId: user.id }, select: { id: true } }))) return notFound('Task not found')
    } else if (projectId) {
      if (!(await prisma.project.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true } }))) return notFound('Project not found')
    } else if (noteId) {
      // Image d'une note : uniquement des images
      if (!(await prisma.note.findFirst({ where: { id: noteId, userId: user.id }, select: { id: true } }))) return notFound('Note not found')
      if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) return badRequest('Seules les images PNG, JPEG, GIF et WebP sont acceptées')
    } else if (tripId) {
      // Document d'un voyage, rattaché si besoin à une réservation, une dépense ou une page du carnet
      // Voyage créé par moi ou partagé avec moi
      if (!(await accessibleTrip(tripId, user.id))) return notFound('Trip not found')
      tripItemId = field('tripItemId')
      if (tripItemId) {
        const where = { id: tripItemId, tripId }
        const [booking, expense, entry] = await Promise.all([
          prisma.tripBooking.findFirst({ where, select: { id: true } }),
          prisma.tripExpense.findFirst({ where, select: { id: true } }),
          prisma.tripJournalEntry.findFirst({ where, select: { id: true } }),
        ])
        if (!booking && !expense && !entry) return notFound('Trip item not found')
      }
    } else if (travelDocId) {
      if (!(await prisma.travelDocument.findFirst({ where: { id: travelDocId, userId: user.id }, select: { id: true } }))) return notFound('Document not found')
    } else {
      return badRequest('Project, task, note, trip or document is required')
    }

    const storageKey = await storeFile(Buffer.from(await file.arrayBuffer()))
    try {
      const attachment = await prisma.attachment.create({
        data: {
          userId: user.id,
          taskId,
          projectId: taskId ? null : projectId,
          noteId: taskId || projectId ? null : noteId,
          tripId: taskId || projectId || noteId ? null : tripId,
          tripItemId: taskId || projectId || noteId ? null : tripItemId,
          travelDocId: taskId || projectId || noteId || tripId ? null : travelDocId,
          name: (file.name || 'fichier').slice(0, 255),
          mimeType: (file.type || 'application/octet-stream').slice(0, 100),
          size: file.size,
          storageKey,
        },
        select: publicFields,
      })
      return NextResponse.json(attachment, { status: 201 })
    } catch (error) {
      await removeStoredFiles([storageKey])
      throw error
    }
  } catch (error) {
    console.error('Error uploading attachment:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
