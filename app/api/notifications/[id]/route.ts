/**
 * PATCH  /api/notifications/[id] — mark one as read
 * DELETE /api/notifications/[id] — delete one
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function ownNotification(email: string, id: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const notif = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  return notif ? { user, notif } : null;
}

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const found = await ownNotification(session.user.email, id);
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const notif = await prisma.notification.update({ where: { id }, data: { read: true } });
  return NextResponse.json(notif);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const found = await ownNotification(session.user.email, id);
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.notification.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
