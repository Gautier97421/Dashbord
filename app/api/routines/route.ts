import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Temporary: hardcoded userId until auth is implemented
const TEMP_USER_ID = 'temp-user-001'

// GET all routine actions
export async function GET() {
  try {
    const actions = await prisma.routineAction.findMany({
      where: { userId: TEMP_USER_ID },
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
    const body = await request.json()
    const { name, category, importance } = body

    const action = await prisma.routineAction.create({
      data: {
        userId: TEMP_USER_ID,
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
    const body = await request.json()
    const { id, name, category, importance } = body

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
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
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
