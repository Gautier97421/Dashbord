/**
 * GET /api/gmail/status
 * Returns whether the authenticated user has connected their Gmail account.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const account = await prisma.oAuthAccount.findFirst({
      where: { userId: user.id, provider: 'gmail' },
      select: { providerUserId: true, createdAt: true },
    });

    return NextResponse.json({
      connected: !!account,
      email: account?.providerUserId || null,
    });
  } catch (error) {
    console.error('Error in /api/gmail/status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
