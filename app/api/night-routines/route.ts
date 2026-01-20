import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all night routine actions
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

    const actions = await prisma.nightRoutineAction.findMany({
      where: { userId: user.id },
      include: {
        logs: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    
    return NextResponse.json(actions)
  } catch (error) {
    console.error('Error fetching night routine actions:', error)
    return NextResponse.json({ error: 'Failed to fetch night routine actions' }, { status: 500 })
  }
}

// POST create a new night routine action
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

    const action = await prisma.nightRoutineAction.create({
      data: {
        userId: user.id,
        name,
        importance,
      },
    })

    return NextResponse.json(action, { status: 201 })
  } catch (error) {
    console.error('Error creating night routine action:', error)
    return NextResponse.json({ error: 'Failed to create night routine action' }, { status: 500 })
  }
}

// PUT update a night routine action
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, importance } = body

    const action = await prisma.nightRoutineAction.update({
      where: { id },
      data: {
        name,
        importance,
      },
    })

    return NextResponse.json(action)
  } catch (error) {
    console.error('Error updating night routine action:', error)
    return NextResponse.json({ error: 'Failed to update night routine action' }, { status: 500 })
  }
}

// DELETE a night routine action
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await prisma.nightRoutineAction.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting night routine action:', error)
    return NextResponse.json({ error: 'Failed to delete night routine action' }, { status: 500 })
  }
}