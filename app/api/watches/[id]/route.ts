/**
 * PATCH  /api/watches/[id] — reset a triggered watch back to "watching"
 * DELETE /api/watches/[id] — remove a watch
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function ownWatch(email: string, id: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const watch = await prisma.watch.findFirst({ where: { id, userId: user.id } });
  return watch ? { user, watch } : null;
}

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const found = await ownWatch(session.user.email, id);
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const watch = await prisma.watch.update({ where: { id }, data: { status: 'watching' } });
  return NextResponse.json(watch);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const found = await ownWatch(session.user.email, id);
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.watch.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
