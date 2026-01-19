import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Temporary: hardcoded userId until auth is implemented
const TEMP_USER_ID = 'temp-user-001'

// GET all tasks
export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: TEMP_USER_ID },
      include: {
        mission: true,
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// POST create a new task
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, description, priority, status, dueDate, missionId, projectId } = body

    const task = await prisma.task.create({
      data: {
        userId: TEMP_USER_ID,
        title,
        description,
        priority,
        status,
        dueDate,
        missionId,
        projectId,
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

// PUT update a task
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, title, description, priority, status, dueDate, missionId, projectId, completedAt } = body

    const task = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        priority,
        status,
        dueDate,
        missionId,
        projectId,
        completedAt,
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

// DELETE a task
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await prisma.task.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}