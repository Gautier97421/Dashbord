import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Temporary: hardcoded userId until auth is implemented
const TEMP_USER_ID = 'temp-user-001'

// GET night routine logs
export async function GET() {
  try {
    const logs = await prisma.nightRoutineLog.findMany({
      where: { userId: TEMP_USER_ID },
      include: {
        action: true,
      },
      orderBy: { date: 'desc' },
    })
    
    return NextResponse.json(logs)
  } catch (error) {
    console.error('Error fetching night routine logs:', error)
    return NextResponse.json({ error: 'Failed to fetch night routine logs' }, { status: 500 })
  }
}

// POST log a night routine action
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { actionId, date, completed } = body

    const log = await prisma.nightRoutineLog.upsert({
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
    console.error('Error creating night routine log:', error)
    return NextResponse.json({ error: 'Failed to create night routine log' }, { status: 500 })
  }
}