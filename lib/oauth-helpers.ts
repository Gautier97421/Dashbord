/**
 * Shared helpers for OAuth flows (state token, redirect URL, token storage).
 */

import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/security/encryption';

export function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path}`;
}

export function generateState(): string {
  return randomBytes(32).toString('hex');
}

export function setCsrfCookie(response: NextResponse, key: string, state: string): void {
  // Only set Secure flag when actually serving over HTTPS — not on http://localhost even in production mode
  const isHttps = process.env.NEXTAUTH_URL?.startsWith('https') ?? false;
  response.cookies.set(key, state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
}

type OAuthProviderValue = 'gmail' | 'outlook' | 'spotify' | 'youtube' | 'linkedin' | 'github' | 'notion' | 'discord' | 'trello';

export async function saveOAuthTokens(
  userId: string,
  provider: OAuthProviderValue,
  providerUserId: string,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: Date
) {
  const encryptedAccess = encrypt(accessToken);
  const encryptedRefresh = refreshToken ? encrypt(refreshToken) : null;
  const p = provider as any;

  await prisma.oAuthAccount.upsert({
    where: { userId_provider: { userId, provider: p } },
    update: { providerUserId, accessToken: encryptedAccess, refreshToken: encryptedRefresh, expiresAt },
    create: { userId, provider: p, providerUserId, accessToken: encryptedAccess, refreshToken: encryptedRefresh, expiresAt },
  });
}

export async function getServiceStatus(userId: string, provider: OAuthProviderValue) {
  const account = await prisma.oAuthAccount.findFirst({
    where: { userId, provider: provider as any },
    select: { providerUserId: true, createdAt: true },
  });
  return { connected: !!account, identifier: account?.providerUserId || null };
}

/** Return the decrypted access token for a connected provider, or null. */
export async function getDecryptedToken(userId: string, provider: OAuthProviderValue): Promise<string | null> {
  const account = await prisma.oAuthAccount.findFirst({
    where: { userId, provider: provider as any },
    select: { accessToken: true },
  });
  if (!account?.accessToken) return null;
  try {
    return decrypt(account.accessToken);
  } catch {
    return null;
  }
}
