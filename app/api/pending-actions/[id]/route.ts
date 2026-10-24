/**
 * POST /api/pending-actions/[id] — approve (execute) or reject a pending action.
 * Body: { decision: 'approve' | 'reject' }
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireFeature } from '@/lib/features';
import { prisma } from '@/lib/prisma';
import { executePendingAction } from '@/lib/ai-agent/pending';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFeature('ai-agent');
  if (denied) return denied;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { id } = await params;
  const action = await prisma.pendingAction.findFirst({ where: { id, userId: user.id } });
  if (!action) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (action.status !== 'pending') return NextResponse.json({ error: 'Déjà traité' }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const decision = body.decision;

  if (decision === 'reject') {
    await prisma.pendingAction.update({ where: { id }, data: { status: 'rejected' } });
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  if (decision === 'approve') {
    try {
      await executePendingAction(user.id, action.kind, action.params as Record<string, any>);
      await prisma.pendingAction.update({ where: { id }, data: { status: 'executed', executedAt: new Date() } });
      return NextResponse.json({ ok: true, status: 'executed' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Échec';
      await prisma.pendingAction.update({ where: { id }, data: { status: 'failed', error: msg } });
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'decision invalide' }, { status: 400 });
}
