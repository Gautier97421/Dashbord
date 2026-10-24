/**
 * POST /api/subscriptions/scan — scan à la demande des emails (6 derniers mois)
 * pour détecter/mettre à jour les abonnements de l'utilisateur.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AI_QUOTA_MESSAGE, takeAiQuota } from '@/lib/rate-limit';
import { scanSubscriptionsForUser } from '@/lib/ai-agent/agent';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!takeAiQuota(user.id)) return NextResponse.json({ error: AI_QUOTA_MESSAGE }, { status: 429 });
    const result = await scanSubscriptionsForUser(user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/subscriptions/scan:', error);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
