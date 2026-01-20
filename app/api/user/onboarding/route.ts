import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET onboarding status
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { hasCompletedOnboarding: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ hasCompletedOnboarding: user.hasCompletedOnboarding })
  } catch (error) {
    console.error('Error getting onboarding status:', error)
    return NextResponse.json({ error: 'Failed to get onboarding status' }, { status: 500 })
  }
}

// POST mark onboarding as complete
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: { hasCompletedOnboarding: true },
    })

    return NextResponse.json({ hasCompletedOnboarding: user.hasCompletedOnboarding })
  } catch (error) {
    console.error('Error updating onboarding status:', error)
    return NextResponse.json({ error: 'Failed to update onboarding status' }, { status: 500 })
  }
}
