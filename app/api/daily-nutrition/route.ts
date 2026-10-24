import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all daily nutrition records (with meals) for the current user
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

    const dailyNutrition = await prisma.dailyNutrition.findMany({
      where: { userId: user.id },
      include: { meals: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(dailyNutrition)
  } catch (error) {
    console.error('Error fetching daily nutrition:', error)
    return NextResponse.json({ error: 'Failed to fetch daily nutrition' }, { status: 500 })
  }
}
