import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { removeStoredFiles } from '@/lib/projects/storage'

const IMAGE_GRACE_MS = 24 * 60 * 60 * 1000

// GET all notes
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const notes = await prisma.note.findMany({
      where: { userId: user.id },
      orderBy: [
        { pinned: 'desc' },
        { updatedAt: 'desc' },
      ],
    })
    
    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching notes:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch notes'
    return NextResponse.json({ error: 'Failed to fetch notes', details: errorMessage }, { status: 500 })
  }
}

// POST create a new note
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, content, color, pinned } = body

    const note = await prisma.note.create({
      data: {
        userId: user.id,
        title,
        content,
        color,
        pinned: pinned || false,
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Error creating note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

// PUT update a note
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { id, title, content, color, pinned } = body

    // Verify note belongs to user
    const existingNote = await prisma.note.findFirst({ where: { id, userId: user.id } })
    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found or unauthorized' }, { status: 404 })
    }

    const note = await prisma.note.update({
      where: { id },
      data: {
        title,
        content,
        color,
        pinned,
      },
    })

    // Images retirées du texte depuis plus d'un jour : supprimées (le délai laisse le temps d'annuler)
    if (typeof content === 'string') {
      const images = await prisma.attachment.findMany({
        where: { noteId: id, createdAt: { lt: new Date(Date.now() - IMAGE_GRACE_MS) } },
        select: { id: true, storageKey: true },
      })
      const unused = images.filter((img) => !content.includes(`/api/attachments/${img.id}`))
      if (unused.length) {
        await prisma.attachment.deleteMany({ where: { id: { in: unused.map((img) => img.id) } } })
        await removeStoredFiles(unused.map((img) => img.storageKey))
      }
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

// DELETE a note
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    // Verify note belongs to user
    const existingNote = await prisma.note.findFirst({ where: { id, userId: user.id } })
    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found or unauthorized' }, { status: 404 })
    }

    // Les images de la note partent avec elle (lignes en cascade, fichiers ici)
    const images = await prisma.attachment.findMany({ where: { noteId: id }, select: { storageKey: true } })
    await prisma.note.delete({
      where: { id },
    })
    await removeStoredFiles(images.map((img) => img.storageKey))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
