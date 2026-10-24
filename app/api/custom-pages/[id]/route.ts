import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

async function getUser(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

// PUT — update a custom page (name, icon, color, order, blocks)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await getUser(session.user.email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const existing = await prisma.customPage.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 60) || 'Sans titre';
    if (typeof body.icon === 'string') data.icon = body.icon.slice(0, 40);
    if (typeof body.color === 'string') data.color = body.color.slice(0, 20);
    if (typeof body.order === 'number') data.order = body.order;
    if (Array.isArray(body.blocks)) data.blocks = body.blocks;

    const page = await prisma.customPage.update({ where: { id }, data });
    return NextResponse.json(page);
  } catch (error) {
    console.error('Error updating custom page:', error);
    return NextResponse.json({ error: 'Failed to update custom page' }, { status: 500 });
  }
}

// DELETE — remove a custom page
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await getUser(session.user.email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const existing = await prisma.customPage.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.customPage.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom page:', error);
    return NextResponse.json({ error: 'Failed to delete custom page' }, { status: 500 });
  }
}
