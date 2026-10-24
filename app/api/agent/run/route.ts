/**
 * POST /api/agent/run — run the autonomous agent now for the current user.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireFeature } from '@/lib/features';
import { prisma } from '@/lib/prisma';
import { AI_QUOTA_MESSAGE, takeAiQuota } from '@/lib/rate-limit';
import { runAgentForUser } from '@/lib/ai-agent/agent';

export async function POST() {
  try {
    const denied = await requireFeature('ai-agent');
    if (denied) return denied;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!takeAiQuota(user.id)) return NextResponse.json({ error: AI_QUOTA_MESSAGE }, { status: 429 });
    const result = await runAgentForUser(user.id, { manual: true });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/agent/run:', error);
    return NextResponse.json({ error: 'Agent run failed' }, { status: 500 });
  }
}
