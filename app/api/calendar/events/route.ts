import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all calendar events
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

    const events = await prisma.calendarEvent.findMany({
      where: { userId: user.id },
      orderBy: { date: 'asc' },
    })
    
    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 })
  }
}

// POST create a new calendar event
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
    const { title, date, startTime, endTime, priority, isRecurring, recurrencePattern, missionId, projectId, completed } = body

    const event = await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        title,
        date,
        startTime,
        endTime,
        priority: priority || 'medium',
        isRecurring: isRecurring || false,
        recurrencePattern,
        missionId,
        projectId,
        completed: completed || false,
      },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating calendar event:', error)
    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 })
  }
}

// PUT update a calendar event
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
    const { id, title, date, startTime, endTime, priority, isRecurring, recurrencePattern, missionId, projectId, completed } = body

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title,
        date,
        startTime,
        endTime,
        priority,
        isRecurring,
        recurrencePattern,
        missionId,
        projectId,
        completed,
      },
    })

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error updating calendar event:', error)
    return NextResponse.json({ error: 'Failed to update calendar event' }, { status: 500 })
  }
}

// DELETE a calendar event
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await prisma.calendarEvent.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting calendar event:', error)
    return NextResponse.json({ error: 'Failed to delete calendar event' }, { status: 500 })
  }
}
