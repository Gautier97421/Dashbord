/**
 * Centralized Gmail client factory with automatic token refresh.
 *
 * Gmail access tokens expire after ~1 hour. This helper checks the stored
 * expiry, refreshes the access token using the refresh token when needed,
 * persists the new (encrypted) token, and returns a ready-to-use GmailClient.
 *
 * Use this everywhere instead of decrypting the token inline.
 */

import { prisma } from '../prisma';
import { decrypt, encrypt } from '../security/encryption';
import { refreshAccessToken } from './oauth';
import { GmailClient } from './client';

export class GmailNotConnectedError extends Error {
  constructor() {
    super('No Gmail account connected. Please authorize Gmail first.');
    this.name = 'GmailNotConnectedError';
  }
}

/**
 * Returns a GmailClient with a valid (non-expired) access token for the user.
 * Throws GmailNotConnectedError if the user has no linked Gmail account.
 */
export async function getGmailClientForUser(userId: string): Promise<GmailClient> {
  const account = await prisma.oAuthAccount.findFirst({
    where: { userId, provider: 'gmail' },
  });

  if (!account) {
    throw new GmailNotConnectedError();
  }

  let accessToken = decrypt(account.accessToken);

  // Refresh if the token is expired (or expires within the next 60 seconds)
  const isExpired =
    account.expiresAt && account.expiresAt.getTime() - Date.now() < 60_000;

  if (isExpired && account.refreshToken) {
    try {
      const refreshToken = decrypt(account.refreshToken);
      const refreshed = await refreshAccessToken(refreshToken);

      accessToken = refreshed.accessToken;

      await prisma.oAuthAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          // Google may rotate the refresh token; persist it if returned
          ...(refreshed.refreshToken
            ? { refreshToken: encrypt(refreshed.refreshToken) }
            : {}),
          expiresAt: refreshed.expiresAt,
        },
      });
    } catch (error) {
      console.error('Failed to refresh Gmail access token:', error);
      // Fall through with the existing token; the API call may still fail
    }
  }

  return new GmailClient(accessToken);
}
