/**
 * Gmail OAuth2 handler
 * Manages OAuth2 authentication flow with Gmail
 */

import { google } from 'googleapis';
import { OAuthTokens } from './types';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify', // Read/modify emails and labels
  'https://www.googleapis.com/auth/gmail.send', // Send emails (not covered by modify)
];

/**
 * Create OAuth2 client
 */
export function createOAuth2Client() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  // Dérivée de NEXTAUTH_URL par défaut, pour suivre le port/domaine réel de l'app
  const redirectUri =
    process.env.GMAIL_REDIRECT_URI ||
    (process.env.NEXTAUTH_URL && `${process.env.NEXTAUTH_URL.replace(/\/$/, '')}/api/gmail/auth/callback`);

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Gmail OAuth environment variables not configured');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate Gmail OAuth authorization URL with CSRF state token
 * Returns both the URL and the state so the caller can store it for validation
 */
export function getAuthorizationUrl(): { url: string; state: string } {
  const oauth2Client = createOAuth2Client();
  const { randomBytes } = require('crypto');
  const state = randomBytes(32).toString('hex');

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });

  return { url, state };
}

/**
 * Exchange authorization code for access token
 * Called at the OAuth callback endpoint
 */
export async function getTokensFromCode(code: string): Promise<OAuthTokens> {
  const oauth2Client = createOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);

  return {
    accessToken: tokens.access_token || '',
    refreshToken: tokens.refresh_token ?? undefined,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  return {
    accessToken: credentials.access_token || '',
    refreshToken: credentials.refresh_token || refreshToken, // May return new refresh token
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
  };
}

/**
 * Get Gmail user profile (to verify token is valid)
 */
export async function getGmailProfile(accessToken: string): Promise<{ emailAddress: string; id: string }> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: 'me' });

  return {
    emailAddress: profile.data.emailAddress || '',
    id: profile.data.historyId || '',
  };
}
