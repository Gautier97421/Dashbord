import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Temporary: hardcoded userId until auth is implemented
const TEMP_USER_ID = 'temp-user-001'

// GET all dashboard widgets
export async function GET() {
  try {
    const widgets = await prisma.dashboardWidget.findMany({
      where: { userId: TEMP_USER_ID },
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
    const body = await request.json()
    const widgets = body.widgets

    // Delete existing widgets and recreate them
    await prisma.dashboardWidget.deleteMany({
      where: { userId: TEMP_USER_ID },
    })

    const updatedWidgets = await prisma.dashboardWidget.createMany({
      data: widgets.map((widget: any) => ({
        userId: TEMP_USER_ID,
        type: widget.type,
        enabled: widget.enabled,
        order: widget.order,
        width: widget.width,
        height: widget.height,
      })),
    })

    // Get the newly created widgets
    const newWidgets = await prisma.dashboardWidget.findMany({
      where: { userId: TEMP_USER_ID },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(newWidgets)
  } catch (error) {
    console.error('Error updating dashboard widgets:', error)
    return NextResponse.json({ error: 'Failed to update dashboard widgets' }, { status: 500 })
  }
}