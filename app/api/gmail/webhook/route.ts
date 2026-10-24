/**
 * POST /api/gmail/webhook
 *
 * Google Cloud Pub/Sub push endpoint for Gmail notifications (real-time).
 * Pub/Sub delivers a message whose data is base64 JSON: { emailAddress, historyId }.
 *
 * On each notification we:
 *   1. find the matching user (by Gmail address stored as providerUserId),
 *   2. list messages added since the last stored historyId,
 *   3. run the user's active "email_received" workflows on those messages,
 *   4. auto-detect job-application confirmations,
 *   5. advance the stored historyId.
 *
 * Security: GMAIL_WEBHOOK_TOKEN is required and the push subscription URL must include
 * "?token=<GMAIL_WEBHOOK_TOKEN>" (otherwise anyone could trigger the agent and its AI calls).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGmailClientForUser } from '@/lib/gmail/get-client';
import { executeWorkflow, trackApplicationsFromEmails } from '@/lib/ai-agent/workflow-runner';
import { runAgentForUser } from '@/lib/ai-agent/agent';
import { EmailMeta } from '@/lib/ai-agent/email-intelligence';
import { WorkflowConfig } from '@/lib/types/workflow';
import { sameSecret } from '@/lib/webhook-token';

export async function POST(req: NextRequest) {
  // Always ack the Pub/Sub message (return 200) to avoid redelivery storms,
  // unless authentication fails.
  const expectedToken = process.env.GMAIL_WEBHOOK_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: 'GMAIL_WEBHOOK_TOKEN not configured' }, { status: 503 });
  }
  if (!sameSecret(req.nextUrl.searchParams.get('token'), expectedToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const dataB64 = body?.message?.data;
    if (!dataB64) {
      return NextResponse.json({ ok: true, skipped: 'no data' });
    }

    const decoded = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf8'));
    const emailAddress: string | undefined = decoded.emailAddress;
    const newHistoryId: string | undefined = decoded.historyId?.toString();

    if (!emailAddress) {
      return NextResponse.json({ ok: true, skipped: 'no emailAddress' });
    }

    // Map the Gmail address to an account
    const account = await prisma.oAuthAccount.findFirst({
      where: { provider: 'gmail', providerUserId: emailAddress },
    });
    if (!account) {
      return NextResponse.json({ ok: true, skipped: 'unknown mailbox' });
    }

    const gmail = await getGmailClientForUser(account.userId);

    // First notification (no baseline yet): just store the cursor and stop
    if (!account.historyId) {
      await prisma.oAuthAccount.update({
        where: { id: account.id },
        data: { historyId: newHistoryId || (await gmail.getProfileHistoryId()) },
      });
      return NextResponse.json({ ok: true, initialized: true });
    }

    // Find what's new since the last cursor
    const newIds = await gmail.getNewMessageIds(account.historyId);

    // Advance the cursor regardless
    if (newHistoryId) {
      await prisma.oAuthAccount.update({
        where: { id: account.id },
        data: { historyId: newHistoryId },
      });
    }

    if (newIds.length === 0) {
      return NextResponse.json({ ok: true, newMessages: 0 });
    }

    const metas = (
      await Promise.all(newIds.map((id) => gmail.getEmailMetadata(id).catch(() => null)))
    ).filter(Boolean) as EmailMeta[];

    // 1. Auto-detect job applications from the new emails
    const trackedApplications = await trackApplicationsFromEmails(account.userId, metas);

    // 1b. Run the autonomous agent (sort subscriptions, notify) if enabled
    const agentCfg = await prisma.agentConfig.findUnique({ where: { userId: account.userId } });
    if (agentCfg?.enabled) {
      await runAgentForUser(account.userId).catch((e) => console.error('agent (webhook) failed:', e));
    }

    // 2. Run active "email_received" workflows with the new messages as input
    const workflows = await prisma.workflow.findMany({
      where: { userId: account.userId, isActive: true },
    });

    let triggered = 0;
    for (const workflow of workflows) {
      const config = workflow.config as unknown as WorkflowConfig;
      const trigger = (config?.nodes || []).find((n) => n.type === 'trigger');
      const triggerType = trigger ? (trigger.data.config as any).type : null;
      if (triggerType !== 'email_received') continue;

      await executeWorkflow(account.userId, workflow.id, config, {
        trigger: 'email_received',
        messageIds: newIds,
        emails: metas,
      });
      triggered++;
    }

    return NextResponse.json({
      ok: true,
      newMessages: newIds.length,
      trackedApplications,
      workflowsTriggered: triggered,
    });
  } catch (error) {
    console.error('Error in /api/gmail/webhook:', error);
    // Return 200 so Pub/Sub doesn't endlessly retry on a poison message
    return NextResponse.json({ ok: false, error: 'processing error' });
  }
}
