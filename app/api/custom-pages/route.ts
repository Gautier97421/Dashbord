import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET — list the user's custom pages (ordered)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const pages = await prisma.customPage.findMany({
      where: { userId: user.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json(pages);
  } catch (error) {
    console.error('Error fetching custom pages:', error);
    return NextResponse.json({ error: 'Failed to fetch custom pages' }, { status: 500 });
  }
}

// POST — create a new custom page
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 60) : 'Nouvelle page';
    const icon = typeof body.icon === 'string' ? body.icon.slice(0, 40) : 'Sparkles';
    const color = typeof body.color === 'string' ? body.color.slice(0, 20) : '#6366f1';

    const count = await prisma.customPage.count({ where: { userId: user.id } });

    const page = await prisma.customPage.create({
      data: {
        userId: user.id,
        name,
        icon,
        color,
        order: count,
        blocks: Array.isArray(body.blocks) ? body.blocks : [],
      },
    });
    return NextResponse.json(page, { status: 201 });
  } catch (error) {
    console.error('Error creating custom page:', error);
    return NextResponse.json({ error: 'Failed to create custom page' }, { status: 500 });
  }
}
