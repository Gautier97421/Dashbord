import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all workouts
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

    const workouts = await prisma.workoutSession.findMany({
      where: { userId: user.id },
      include: {
        program: true,
      },
      orderBy: { date: 'desc' },
    })
    
    return NextResponse.json(workouts)
  } catch (error) {
    console.error('Error fetching workout sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch workout sessions' }, { status: 500 })
  }
}

// POST create a new workout session
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
    const { date, type, customType, duration, notes, intensity, completed, programId, missionId } = body

    const workout = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        date,
        type,
        customType,
        duration,
        notes,
        intensity,
        completed,
        programId,
        missionId,
      },
    })

    return NextResponse.json(workout, { status: 201 })
  } catch (error) {
    console.error('Error creating workout session:', error)
    return NextResponse.json({ error: 'Failed to create workout session' }, { status: 500 })
  }
}

// PUT update a workout session
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
    const { id, date, type, customType, duration, notes, intensity, completed, programId, missionId } = body

    const workout = await prisma.workoutSession.update({
      where: { id },
      data: {
        date,
        type,
        customType,
        duration,
        notes,
        intensity,
        completed,
        programId,
        missionId,
      },
    })

    return NextResponse.json(workout)
  } catch (error) {
    console.error('Error updating workout session:', error)
    return NextResponse.json({ error: 'Failed to update workout session' }, { status: 500 })
  }
}

// DELETE a workout session
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

    await prisma.workoutSession.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting workout session:', error)
    return NextResponse.json({ error: 'Failed to delete workout session' }, { status: 500 })
  }
}