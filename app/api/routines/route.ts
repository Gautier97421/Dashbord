import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all routine actions
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

    const actions = await prisma.routineAction.findMany({
      where: { userId: user.id },
      include: {
        logs: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    
    return NextResponse.json(actions)
  } catch (error) {
    console.error('Error fetching routine actions:', error)
    return NextResponse.json({ error: 'Failed to fetch routine actions' }, { status: 500 })
  }
}

// POST create a new routine action
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
    const { name, category, importance } = body

    const action = await prisma.routineAction.create({
      data: {
        userId: user.id,
        name,
        category,
        importance,
      },
    })

    return NextResponse.json(action, { status: 201 })
  } catch (error) {
    console.error('Error creating routine action:', error)
    return NextResponse.json({ error: 'Failed to create routine action' }, { status: 500 })
  }
}

// PUT update a routine action
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
    const { id, name, category, importance } = body

    // Verify routine belongs to user
    const existingAction = await prisma.routineAction.findFirst({ where: { id, userId: user.id } })
    if (!existingAction) {
      return NextResponse.json({ error: 'Routine action not found' }, { status: 404 })
    }

    const action = await prisma.routineAction.update({
      where: { id },
      data: {
        name,
        category,
        importance,
      },
    })

    return NextResponse.json(action)
  } catch (error) {
    console.error('Error updating routine action:', error)
    return NextResponse.json({ error: 'Failed to update routine action' }, { status: 500 })
  }
}

// DELETE a routine action
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

    // Verify routine belongs to user
    const existingAction = await prisma.routineAction.findFirst({ where: { id, userId: user.id } })
    if (!existingAction) {
      return NextResponse.json({ error: 'Routine action not found' }, { status: 404 })
    }

    await prisma.routineAction.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting routine action:', error)
    return NextResponse.json({ error: 'Failed to delete routine action' }, { status: 500 })
  }
}
