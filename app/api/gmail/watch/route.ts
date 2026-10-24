/**
 * POST /api/gmail/watch
 *
 * Starts (or renews) a Gmail push subscription for the authenticated user.
 * Requires GMAIL_PUBSUB_TOPIC (a Google Cloud Pub/Sub topic name like
 * "projects/<project>/topics/<topic>") that Gmail is allowed to publish to.
 *
 * The Gmail watch expires after ~7 days, so call this periodically (e.g. daily
 * via the cron) to keep push notifications alive.
 *
 * DELETE /api/gmail/watch — stops push notifications.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getGmailClientForUser, GmailNotConnectedError } from '@/lib/gmail/get-client';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const topic = process.env.GMAIL_PUBSUB_TOPIC;
    if (!topic) {
      return NextResponse.json(
        { error: 'GMAIL_PUBSUB_TOPIC is not configured' },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const gmail = await getGmailClientForUser(user.id);
    const { historyId, expiration } = await gmail.watch(topic);

    await prisma.oAuthAccount.updateMany({
      where: { userId: user.id, provider: 'gmail' },
      data: {
        historyId,
        watchExpiration: expiration ? new Date(Number(expiration)) : null,
      },
    });

    return NextResponse.json({ success: true, historyId, expiration });
  } catch (error) {
    console.error('Error in POST /api/gmail/watch:', error);
    if (error instanceof GmailNotConnectedError) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to start Gmail watch' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const gmail = await getGmailClientForUser(user.id);
    await gmail.stopWatch();

    await prisma.oAuthAccount.updateMany({
      where: { userId: user.id, provider: 'gmail' },
      data: { historyId: null, watchExpiration: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/gmail/watch:', error);
    return NextResponse.json({ error: 'Failed to stop Gmail watch' }, { status: 500 });
  }
}
