import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all sleep logs
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

    const sleepLogs = await prisma.sleepLog.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
    })
    
    return NextResponse.json(sleepLogs)
  } catch (error) {
    console.error('Error fetching sleep logs:', error)
    return NextResponse.json({ error: 'Failed to fetch sleep logs' }, { status: 500 })
  }
}

// POST create or update a sleep log
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
    const { date, bedTime, wakeTime, duration, quality, notes } = body

    const sleepLog = await prisma.sleepLog.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date,
        },
      },
      update: {
        bedTime,
        wakeTime,
        duration,
        quality,
        notes,
      },
      create: {
        userId: user.id,
        date,
        bedTime,
        wakeTime,
        duration,
        quality,
        notes,
      },
    })

    return NextResponse.json(sleepLog, { status: 201 })
  } catch (error) {
    console.error('Error creating/updating sleep log:', error)
    return NextResponse.json({ error: 'Failed to create/update sleep log' }, { status: 500 })
  }
}

// DELETE a sleep log
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await prisma.sleepLog.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting sleep log:', error)
    return NextResponse.json({ error: 'Failed to delete sleep log' }, { status: 500 })
  }
}