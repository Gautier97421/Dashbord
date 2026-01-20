import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET fitness profile
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

    const profile = await prisma.fitnessProfile.findUnique({
      where: { userId: user.id },
    })
    
    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error fetching fitness profile:', error)
    return NextResponse.json({ error: 'Failed to fetch fitness profile' }, { status: 500 })
  }
}

// POST/PUT create or update fitness profile (upsert)
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
    const { age, weight, height, gender, goal, activityLevel, targetWeight } = body

    const profile = await prisma.fitnessProfile.upsert({
      where: { userId: user.id },
      update: {
        age,
        weight,
        height,
        gender,
        goal,
        activityLevel,
        targetWeight,
      },
      create: {
        userId: user.id,
        age,
        weight,
        height,
        gender,
        goal,
        activityLevel,
        targetWeight,
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error saving fitness profile:', error)
    return NextResponse.json({ error: 'Failed to save fitness profile' }, { status: 500 })
  }
}

// PUT update fitness profile
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
    const { age, weight, height, gender, goal, activityLevel, targetWeight } = body

    const profile = await prisma.fitnessProfile.update({
      where: { userId: user.id },
      data: {
        age,
        weight,
        height,
        gender,
        goal,
        activityLevel,
        targetWeight,
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error updating fitness profile:', error)
    return NextResponse.json({ error: 'Failed to update fitness profile' }, { status: 500 })
  }
}

// DELETE fitness profile
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.fitnessProfile.delete({
      where: { userId: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting fitness profile:', error)
    return NextResponse.json({ error: 'Failed to delete fitness profile' }, { status: 500 })
  }
}
