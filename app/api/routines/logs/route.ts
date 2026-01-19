import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Temporary: hardcoded userId until auth is implemented
const TEMP_USER_ID = 'temp-user-001'

// GET routine logs
export async function GET() {
  try {
    const logs = await prisma.routineLog.findMany({
      where: { userId: TEMP_USER_ID },
      include: {
        action: true,
      },
      orderBy: { date: 'desc' },
    })
    
    return NextResponse.json(logs)
  } catch (error) {
    console.error('Error fetching routine logs:', error)
    return NextResponse.json({ error: 'Failed to fetch routine logs' }, { status: 500 })
  }
}

// POST log a routine action
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { actionId, date, completed } = body

    const log = await prisma.routineLog.upsert({
      where: {
        actionId_date: {
          actionId,
          date,
        },
      },
      update: {
        completed,
      },
      create: {
        userId: TEMP_USER_ID,
        actionId,
        date,
        completed,
      },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error) {
    console.error('Error creating routine log:', error)
    return NextResponse.json({ error: 'Failed to create routine log' }, { status: 500 })
  }
}