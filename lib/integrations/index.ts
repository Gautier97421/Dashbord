/**
 * Third-party integration sync — turns external events into app notifications.
 *
 * Each function reads the user's stored OAuth token, queries the service, and
 * creates de-duplicated notifications. All are best-effort and never throw.
 */

import { getDecryptedToken } from '@/lib/oauth-helpers';
import { createNotification } from '@/lib/notifications';

export interface IntegrationSyncResult {
  github: number;
  trello: number;
  errors: string[];
}

/** Run all connected integrations for a user and return how many notifications were created. */
export async function syncIntegrations(userId: string): Promise<IntegrationSyncResult> {
  const result: IntegrationSyncResult = { github: 0, trello: 0, errors: [] };

  try { result.github = await syncGitHub(userId); }
  catch (e) { result.errors.push('github: ' + (e instanceof Error ? e.message : 'error')); }

  try { result.trello = await syncTrello(userId); }
  catch (e) { result.errors.push('trello: ' + (e instanceof Error ? e.message : 'error')); }

  return result;
}

/**
 * GitHub: surface unread notifications (issues/PRs mentioning or assigned to you).
 */
export async function syncGitHub(userId: string): Promise<number> {
  const token = await getDecryptedToken(userId, 'github');
  if (!token) return 0;

  const res = await fetch('https://api.github.com/notifications?per_page=20', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return 0;
  const items: any[] = await res.json();

  let created = 0;
  for (const n of items) {
    const subject = n.subject?.title || 'Notification GitHub';
    const repo = n.repository?.full_name || '';
    const reason = translateReason(n.reason);
    const ok = await createNotification({
      userId,
      type: 'agent',
      title: `GitHub — ${subject}`,
      body: `${repo}${reason ? ' · ' + reason : ''}`,
      link: 'ai-agent',
      dedupeKey: `gh:${n.id}:${n.updated_at}`,
      meta: { url: n.subject?.url },
    });
    if (ok) created++;
  }
  return created;
}

function translateReason(reason: string): string {
  const map: Record<string, string> = {
    assign: 'Qui t\'est assigné', mention: 'Tu es mentionné', review_requested: 'Revue demandée',
    author: 'Tu en es l\'auteur', comment: 'Nouveau commentaire', subscribed: 'Abonné',
    state_change: 'Changement d\'état', team_mention: 'Ton équipe est mentionnée',
  };
  return map[reason] || '';
}

/**
 * Trello: notify about cards with a due date in the next 48h (not yet complete).
 */
export async function syncTrello(userId: string): Promise<number> {
  const token = await getDecryptedToken(userId, 'trello');
  const key = process.env.TRELLO_API_KEY;
  if (!token || !key) return 0;

  const res = await fetch(
    `https://api.trello.com/1/members/me/cards?key=${key}&token=${token}&fields=name,due,dueComplete,url`
  );
  if (!res.ok) return 0;
  const cards: any[] = await res.json();

  const now = Date.now();
  const soon = now + 48 * 3600 * 1000;
  let created = 0;
  for (const c of cards) {
    if (!c.due || c.dueComplete) continue;
    const dueTs = new Date(c.due).getTime();
    if (dueTs > soon) continue; // not soon enough
    const ok = await createNotification({
      userId,
      type: 'important',
      title: `Trello — échéance : ${c.name}`,
      body: `À rendre le ${new Date(c.due).toLocaleString('fr-FR')}`,
      link: 'ai-agent',
      dedupeKey: `trello:${c.id}:${c.due}`,
      meta: { url: c.url },
    });
    if (ok) created++;
  }
  return created;
}

/**
 * Notion: create a quick page from text in the user's workspace.
 * Returns the created page URL, or throws on failure.
 */
export async function createNotionNote(userId: string, title: string, content: string): Promise<string> {
  const token = await getDecryptedToken(userId, 'notion');
  if (!token) throw new Error('Notion non connecté');

  // Find a page the integration can write to (first search result)
  const searchRes = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ filter: { value: 'page', property: 'object' }, page_size: 1 }),
  });
  const search = await searchRes.json();
  const parent = search.results?.[0];
  if (!parent) throw new Error('Aucune page Notion accessible. Partage une page avec l\'intégration.');

  const createRes = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { page_id: parent.id },
      properties: { title: { title: [{ text: { content: title || 'Note' } }] } },
      children: content
        ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: content.slice(0, 1900) } }] } }]
        : [],
    }),
  });
  const page = await createRes.json();
  if (!createRes.ok || !page.id) throw new Error(page.message || 'Création Notion échouée');
  return page.url || 'https://notion.so';
}
