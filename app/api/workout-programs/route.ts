import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Temporary: hardcoded userId until auth is implemented
const TEMP_USER_ID = 'temp-user-001'

// GET all workout programs
export async function GET() {
  try {
    const programs = await prisma.workoutProgram.findMany({
      where: { userId: TEMP_USER_ID },
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
    const body = await request.json()
    const { name, description, sessions, active, autoCreateMissions } = body

    const program = await prisma.workoutProgram.create({
      data: {
        userId: TEMP_USER_ID,
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