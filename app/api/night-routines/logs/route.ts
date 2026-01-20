import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all night routine logs
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

    const logs = await prisma.nightRoutineLog.findMany({
      where: { userId: user.id },
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { actionId, date, completed } = body

    const log = await prisma.nightRoutineLog.upsert({
      where: {
        userId_actionId_date: {
          userId: user.id,
          actionId,
          date,
        },
      },
      update: {
        completed,
      },
      create: {
        userId: user.id,
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