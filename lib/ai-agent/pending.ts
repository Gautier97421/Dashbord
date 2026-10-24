/**
 * Pending action queue — staging + execution of irreversible actions.
 *
 * In safe mode, automations never act directly: they call stagePendingAction()
 * which records the action for the user to approve. executePendingAction()
 * performs the real, irreversible action once the user approves it.
 */

import { prisma } from '@/lib/prisma';
import { getGmailClientForUser } from '@/lib/gmail/get-client';
import { postToDiscordWebhook } from '@/lib/integrations/discord';
import { createNotionNote } from '@/lib/integrations';
import { outlookSendMail } from '@/lib/integrations/outlook';
import { createGitHubIssue, createTrelloCard, postToSlackWebhook, sendTelegramMessage } from '@/lib/integrations/actions';
import { createNotification } from '@/lib/notifications';
import { safeRequest } from '@/lib/security/safe-fetch';

export type PendingKind =
  | 'gmail_send'
  | 'gmail_delete'
  | 'outlook_send'
  | 'discord_send'
  | 'slack_send'
  | 'telegram_send'
  | 'notion_create'
  | 'github_issue'
  | 'trello_card'
  | 'http_request';

/** Record an action for approval and notify the user. */
export async function stagePendingAction(
  userId: string,
  kind: PendingKind,
  summary: string,
  params: Record<string, any>,
  workflowId?: string
): Promise<void> {
  await prisma.pendingAction.create({
    data: { userId, kind, summary, params: params as any, workflowId: workflowId || null },
  });
  await createNotification({
    userId,
    type: 'agent',
    title: 'Action à valider',
    body: summary,
    link: 'validation',
  });
}

/** Perform the real, irreversible action described by a pending record. */
export async function executePendingAction(userId: string, kind: string, params: Record<string, any>): Promise<void> {
  switch (kind) {
    case 'gmail_send': {
      const gmail = await getGmailClientForUser(userId);
      await gmail.sendEmail({ to: params.to, subject: params.subject || '(sans objet)', body: params.body || '' });
      return;
    }
    case 'gmail_delete': {
      const gmail = await getGmailClientForUser(userId);
      const ids: string[] = Array.isArray(params.messageIds) ? params.messageIds : [];
      if (ids.length === 0) return;
      if (params.permanent === true) await gmail.deleteEmailsPermanently(ids);
      else await gmail.deleteEmails(ids);
      return;
    }
    case 'outlook_send': {
      await outlookSendMail(userId, { to: params.to, subject: params.subject || '(sans objet)', body: params.body || '' });
      return;
    }
    case 'discord_send': {
      const ok = await postToDiscordWebhook(params.webhookUrl, params.message || '');
      if (!ok) throw new Error('Webhook Discord invalide');
      return;
    }
    case 'slack_send': {
      await postToSlackWebhook(params.webhookUrl, params.message || '');
      return;
    }
    case 'telegram_send': {
      await sendTelegramMessage(params.botToken, params.chatId, params.message || '');
      return;
    }
    case 'notion_create': {
      await createNotionNote(userId, params.title || 'Note', params.content || '');
      return;
    }
    case 'github_issue': {
      await createGitHubIssue(userId, params.repo, params.title, params.body);
      return;
    }
    case 'trello_card': {
      await createTrelloCard(userId, params.listId, params.name, params.desc);
      return;
    }
    case 'http_request': {
      const method = (params.method || 'GET').toUpperCase();
      const isWrite = !['GET', 'HEAD'].includes(method);
      let headers: Record<string, string> = {};
      if (params.headers) { try { headers = JSON.parse(params.headers); } catch { /* ignore */ } }
      const res = await safeRequest(params.url, {
        method, headers,
        body: isWrite && params.body ? params.body : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return;
    }
    default:
      throw new Error(`Type d'action inconnu : ${kind}`);
  }
}
