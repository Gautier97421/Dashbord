import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Temporary: hardcoded userId until auth is implemented
const TEMP_USER_ID = 'temp-user-001'

// GET all sleep logs
export async function GET() {
  try {
    const sleepLogs = await prisma.sleepLog.findMany({
      where: { userId: TEMP_USER_ID },
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
    const body = await request.json()
    const { date, bedTime, wakeTime, duration, quality, notes } = body

    const sleepLog = await prisma.sleepLog.upsert({
      where: {
        userId_date: {
          userId: TEMP_USER_ID,
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
        userId: TEMP_USER_ID,
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