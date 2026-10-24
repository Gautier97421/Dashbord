/**
 * GET /api/pending-actions — list pending (and recently resolved) actions.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireFeature } from '@/lib/features';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const denied = await requireFeature('ai-agent');
  if (denied) return denied;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const [pending, recent] = await Promise.all([
    prisma.pendingAction.findMany({ where: { userId: user.id, status: 'pending' }, orderBy: { createdAt: 'desc' } }),
    prisma.pendingAction.findMany({ where: { userId: user.id, status: { not: 'pending' } }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  return NextResponse.json({ pending, recent, pendingCount: pending.length });
}
