import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all dashboard widgets
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

    const widgets = await prisma.dashboardWidget.findMany({
      where: { userId: user.id },
      orderBy: { order: 'asc' },
    })
    
    return NextResponse.json(widgets)
  } catch (error) {
    console.error('Error fetching dashboard widgets:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard widgets' }, { status: 500 })
  }
}

// PUT update all dashboard widgets (for reordering/resizing)
export async function PUT(request: Request) {
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
    const widgets = body.widgets

    // Delete existing widgets and recreate them
    await prisma.dashboardWidget.deleteMany({
      where: { userId: user.id },
    })

    await prisma.dashboardWidget.createMany({
      data: widgets.map((widget: any) => ({
        userId: user.id,
        type: widget.type,
        enabled: widget.enabled,
        order: widget.order,
        width: widget.width,
        height: widget.height,
      })),
    })

    // Get the newly created widgets for the current user
    const newWidgets = await prisma.dashboardWidget.findMany({
      where: { userId: user.id },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(newWidgets)
  } catch (error) {
    console.error('Error updating dashboard widgets:', error)
    return NextResponse.json({ error: 'Failed to update dashboard widgets' }, { status: 500 })
  }
}