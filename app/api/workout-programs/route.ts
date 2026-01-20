import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all workout programs
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

    const programs = await prisma.workoutProgram.findMany({
      where: { userId: user.id },
      include: {
        sessions: true,
        workouts: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    
    return NextResponse.json(programs)
  } catch (error) {
    console.error('Error fetching workout programs:', error)
    return NextResponse.json({ error: 'Failed to fetch workout programs' }, { status: 500 })
  }
}

// POST create a new workout program
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
    const { name, description, sessions = [], active = true, autoCreateMissions = false } = body

    const program = await prisma.workoutProgram.create({
      data: {
        userId: user.id,
        name,
        description,
        active,
        autoCreateMissions,
        sessions: {
          create: sessions,
        },
      },
      include: {
        sessions: true,
      },
    })

    return NextResponse.json(program, { status: 201 })
  } catch (error) {
    console.error('Error creating workout program:', error)
    return NextResponse.json({ error: 'Failed to create workout program' }, { status: 500 })
  }
}

// PUT update a workout program
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, description, sessions, active, autoCreateMissions } = body

    // Update the program and replace all sessions
    const program = await prisma.workoutProgram.update({
      where: { id },
      data: {
        name,
        description,
        active,
        autoCreateMissions,
        sessions: {
          deleteMany: {},
          create: sessions,
        },
      },
      include: {
        sessions: true,
      },
    })

    return NextResponse.json(program)
  } catch (error) {
    console.error('Error updating workout program:', error)
    return NextResponse.json({ error: 'Failed to update workout program' }, { status: 500 })
  }
}

// DELETE a workout program
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await prisma.workoutProgram.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting workout program:', error)
    return NextResponse.json({ error: 'Failed to delete workout program' }, { status: 500 })
  }
}