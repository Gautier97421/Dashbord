/**
 * POST /api/applications/scan
 *
 * On-demand scan: reads the user's recent emails, detects application
 * confirmation emails with the AI, and creates tracking entries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AI_QUOTA_MESSAGE, takeAiQuota } from '@/lib/rate-limit';
import { getGmailClientForUser, GmailNotConnectedError } from '@/lib/gmail/get-client';
import { trackApplicationsFromEmails } from '@/lib/ai-agent/workflow-runner';
import { EmailMeta } from '@/lib/ai-agent/email-intelligence';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!takeAiQuota(user.id)) return NextResponse.json({ error: AI_QUOTA_MESSAGE }, { status: 429 });
    const gmail = await getGmailClientForUser(user.id);

    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === 'string' ? body.query : 'newer_than:30d';

    const search = await gmail.searchEmails({ q: query, maxResults: 40 });
    const ids = (search.messages || []).map((m) => m.id);
    const metas = (
      await Promise.all(ids.map((id) => gmail.getEmailMetadata(id).catch(() => null)))
    ).filter(Boolean) as EmailMeta[];

    const created = await trackApplicationsFromEmails(user.id, metas);

    return NextResponse.json({ scanned: metas.length, created });
  } catch (error) {
    console.error('Error in POST /api/applications/scan:', error);
    if (error instanceof GmailNotConnectedError) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to scan emails' }, { status: 500 });
  }
}
