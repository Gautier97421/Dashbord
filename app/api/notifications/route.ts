/**
 * GET   /api/notifications        — list recent notifications (+ unread count)
 * PATCH /api/notifications         — mark all as read
 * DELETE /api/notifications        — clear all
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { maybeRunProjectAlerts } from '@/lib/projects/alerts-runner';
import { getAlertPrefs, mergeAlertPrefs, saveAlertPrefs } from '@/lib/projects/alert-prefs';

async function currentUser(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await currentUser(session.user.email);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Fuseau du navigateur (?tz=…) : les alertes projets savent ainsi quel jour on est chez l'utilisateur
  const tz = new URL(request.url).searchParams.get('tz');
  if (tz) {
    const prefs = await getAlertPrefs(user.id);
    if (prefs.timeZone !== tz) await saveAlertPrefs(user.id, mergeAlertPrefs(prefs, { timeZone: tz }));
  }
  // Sans cron (développement local), les alertes sont calculées ici, au plus toutes les 10 minutes
  await maybeRunProjectAlerts(user.id);

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return NextResponse.json({ items, unread });
}

export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await currentUser(session.user.email);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await currentUser(session.user.email);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await prisma.notification.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ success: true });
}
