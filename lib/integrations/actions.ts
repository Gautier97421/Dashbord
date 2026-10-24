/**
 * Write actions on external services used by workflow nodes (and by the
 * "À valider" queue once the user approves them in safe mode).
 */

import { getDecryptedToken } from '@/lib/oauth-helpers';

const TIMEOUT = 20000;

/** Create a GitHub issue in "owner/repo". Returns the issue URL. */
export async function createGitHubIssue(userId: string, repo: string, title: string, body?: string): Promise<string> {
  const token = await getDecryptedToken(userId, 'github');
  if (!token) throw new Error('GitHub non connecté');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Dépôt invalide (format : propriétaire/nom)');

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body: body || '' }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
  return data.html_url;
}

/** Create a Trello card in a list. Returns the card URL. */
export async function createTrelloCard(userId: string, listId: string, name: string, desc?: string): Promise<string> {
  const token = await getDecryptedToken(userId, 'trello');
  const key = process.env.TRELLO_API_KEY;
  if (!token || !key) throw new Error('Trello non connecté');

  const params = new URLSearchParams({ key, token, idList: listId, name, desc: desc || '' });
  const res = await fetch(`https://api.trello.com/1/cards?${params}`, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data === 'string' ? data : `Trello ${res.status}`);
  return data.shortUrl || data.url;
}

/** Post a message to a Slack incoming webhook. */
export async function postToSlackWebhook(url: string, message: string): Promise<void> {
  // Only Slack's own webhook host, so the node cannot be used to call arbitrary URLs
  if (!/^https:\/\/hooks\.slack\.com\//.test(url || '')) throw new Error('URL de webhook Slack invalide');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Slack ${res.status}`);
}

/** Send a message through a Telegram bot. */
export async function sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<void> {
  if (!/^\d+:[\w-]+$/.test(botToken || '')) throw new Error('Token de bot Telegram invalide');
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.description || `Telegram ${res.status}`);
}
