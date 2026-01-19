import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Temporary: hardcoded userId until auth is implemented
const TEMP_USER_ID = 'temp-user-001'

// GET all missions
export async function GET() {
  try {
    const missions = await prisma.mission.findMany({
      where: { userId: TEMP_USER_ID },
      include: {
        tasks: true,
        calendarEvents: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    
    return NextResponse.json(missions)
  } catch (error) {
    console.error('Error fetching missions:', error)
    return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 })
  }
}

// POST create a new mission
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, description, timeFrame, priority, status, dueDate } = body

    const mission = await prisma.mission.create({
      data: {
        userId: TEMP_USER_ID,
        title,
        description,
        timeFrame,
        priority,
        status,
        dueDate,
      },
    })

    return NextResponse.json(mission, { status: 201 })
  } catch (error) {
    console.error('Error creating mission:', error)
    return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 })
  }
}

// PUT update a mission
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, title, description, timeFrame, priority, status, dueDate, completedAt } = body

    const mission = await prisma.mission.update({
      where: { id },
      data: {
        title,
        description,
        timeFrame,
        priority,
        status,
        dueDate,
        completedAt,
      },
    })

    return NextResponse.json(mission)
  } catch (error) {
    console.error('Error updating mission:', error)
    return NextResponse.json({ error: 'Failed to update mission' }, { status: 500 })
  }
}

// DELETE a mission
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await prisma.mission.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting mission:', error)
    return NextResponse.json({ error: 'Failed to delete mission' }, { status: 500 })
  }
}