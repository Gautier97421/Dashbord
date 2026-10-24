/**
 * Outlook (Microsoft Graph) — mail reading, sending and moving for workflows.
 *
 * Requires an Azure app registration: MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET,
 * with the redirect URI <NEXTAUTH_URL>/api/outlook/auth/callback.
 */

import { prisma } from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/security/encryption';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
export const OUTLOOK_AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
export const OUTLOOK_SCOPES = 'offline_access openid email User.Read Mail.ReadWrite Mail.Send';

const WELL_KNOWN_FOLDERS = new Set(['inbox', 'archive', 'drafts', 'sentitems', 'deleteditems', 'junkemail', 'outbox']);

export class OutlookNotConnectedError extends Error {
  constructor() {
    super('Outlook non connecté. Connecte-le dans Paramètres → Connexions.');
    this.name = 'OutlookNotConnectedError';
  }
}

export interface OutlookEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  isRead: boolean;
}

/** Exchange an authorization code or a refresh token for Microsoft tokens. */
export async function exchangeOutlookToken(params: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      scope: OUTLOOK_SCOPES,
      ...params,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || 'Échange de jeton Microsoft échoué');
  }
  return data as { access_token: string; refresh_token?: string; expires_in: number };
}

/** Email address of the account the access token belongs to. */
export async function getOutlookAddress(accessToken: string): Promise<string> {
  const res = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const me = await res.json().catch(() => ({}));
  return me.mail || me.userPrincipalName || 'Outlook';
}

// Valid access token for the user, refreshed when about to expire
async function getOutlookToken(userId: string): Promise<string> {
  const account = await prisma.oAuthAccount.findFirst({ where: { userId, provider: 'outlook' as any } });
  if (!account) throw new OutlookNotConnectedError();

  const expired = account.expiresAt && account.expiresAt.getTime() - Date.now() < 60_000;
  if (!expired || !account.refreshToken) return decrypt(account.accessToken);

  const tokens = await exchangeOutlookToken({
    grant_type: 'refresh_token',
    refresh_token: decrypt(account.refreshToken),
  });
  await prisma.oAuthAccount.update({
    where: { id: account.id },
    data: {
      accessToken: encrypt(tokens.access_token),
      ...(tokens.refresh_token ? { refreshToken: encrypt(tokens.refresh_token) } : {}),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
  return tokens.access_token;
}

async function graph(userId: string, path: string, init: RequestInit = {}): Promise<any> {
  const token = await getOutlookToken(userId);
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 202 || res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Outlook ${res.status}`);
  return data;
}

// Folder id from a well-known name (inbox, archive…) or a folder display name
async function resolveFolderId(userId: string, name: string, create: boolean): Promise<string> {
  const key = name.trim();
  if (WELL_KNOWN_FOLDERS.has(key.toLowerCase())) return key.toLowerCase();

  const filter = encodeURIComponent(`displayName eq '${key.replace(/'/g, "''")}'`);
  const found = await graph(userId, `/me/mailFolders?$filter=${filter}`);
  if (found?.value?.[0]?.id) return found.value[0].id;
  if (!create) throw new Error(`Dossier Outlook introuvable : ${key}`);

  const created = await graph(userId, '/me/mailFolders', { method: 'POST', body: JSON.stringify({ displayName: key }) });
  return created.id;
}

export async function outlookListMessages(
  userId: string,
  { search, folder = 'inbox', top = 10 }: { search?: string; folder?: string; top?: number }
): Promise<OutlookEmail[]> {
  const folderId = await resolveFolderId(userId, folder || 'inbox', false);
  const params = new URLSearchParams({
    $top: String(Math.min(Math.max(top, 1), 50)),
    $select: 'id,subject,from,receivedDateTime,bodyPreview,isRead',
  });
  // Graph does not allow $search together with $orderby
  if (search) params.set('$search', `"${search.replace(/"/g, '')}"`);
  else params.set('$orderby', 'receivedDateTime desc');

  const data = await graph(userId, `/me/mailFolders/${encodeURIComponent(folderId)}/messages?${params}`);
  return (data?.value || []).map((m: any) => ({
    id: m.id,
    subject: m.subject || '',
    from: m.from?.emailAddress?.address || '',
    date: m.receivedDateTime,
    snippet: m.bodyPreview || '',
    isRead: !!m.isRead,
  }));
}

export async function outlookSendMail(userId: string, { to, subject, body }: { to: string; subject: string; body: string }) {
  const toRecipients = to
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));
  if (toRecipients.length === 0) throw new Error('Destinataire requis');

  await graph(userId, '/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: { subject, body: { contentType: 'Text', content: body }, toRecipients },
      saveToSentItems: true,
    }),
  });
}

/** Move messages into a folder (created if it does not exist). Returns how many were moved. */
export async function outlookMoveMessages(userId: string, ids: string[], folderName: string): Promise<number> {
  const destinationId = await resolveFolderId(userId, folderName, true);
  let moved = 0;
  for (const id of ids.slice(0, 50)) {
    await graph(userId, `/me/messages/${encodeURIComponent(id)}/move`, {
      method: 'POST',
      body: JSON.stringify({ destinationId }),
    });
    moved++;
  }
  return moved;
}
