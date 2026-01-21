import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all missions
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

    const missions = await prisma.mission.findMany({
      where: { userId: user.id },
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, timeFrame, priority, status, dueDate } = body

    const mission = await prisma.mission.create({
      data: {
        userId: user.id,
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { id, title, description, timeFrame, priority, status, dueDate, completedAt, tasks } = body

    // Vérifier que la mission appartient à l'utilisateur
    const existingMission = await prisma.mission.findFirst({
      where: { id, userId: user.id },
    })

    if (!existingMission) {
      return NextResponse.json({ error: 'Mission not found or unauthorized' }, { status: 404 })
    }

    // Update mission
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

    // Handle tasks update if provided
    if (tasks && Array.isArray(tasks)) {
      // Delete existing tasks and recreate
      await prisma.task.deleteMany({
        where: { missionId: id },
      })

      // Create new tasks
      if (tasks.length > 0) {
        await prisma.task.createMany({
          data: tasks.map((task: any) => ({
            userId: user.id,
            missionId: id,
            title: task.title,
            description: task.description,
            priority: task.priority || 'medium',
            status: task.status || 'todo',
            dueDate: task.dueDate,
          })),
        })
      }
    }

    // Return mission with tasks
    const updatedMission = await prisma.mission.findUnique({
      where: { id },
      include: { tasks: true, calendarEvents: true },
    })

    return NextResponse.json(updatedMission)
  } catch (error) {
    console.error('Error updating mission:', error)
    return NextResponse.json({ error: 'Failed to update mission' }, { status: 500 })
  }
}

// DELETE a mission
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

    // Vérifier que la mission appartient à l'utilisateur
    const existingMission = await prisma.mission.findFirst({
      where: { id, userId: user.id },
    })

    if (!existingMission) {
      return NextResponse.json({ error: 'Mission not found or unauthorized' }, { status: 404 })
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