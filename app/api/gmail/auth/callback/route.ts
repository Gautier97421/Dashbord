import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTokensFromCode, getGmailProfile } from '@/lib/gmail/oauth';
import { encrypt } from '@/lib/security/encryption';
import { initializeGmailTools } from '@/lib/tools/gmail';
import { toolRegistry } from '@/lib/tools/base';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';
import { saveOAuthTokens } from '@/lib/oauth-helpers';

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path}`;
}

function clearCookies(res: NextResponse) {
  res.cookies.delete('gmail_oauth_state');
  res.cookies.delete('google_oauth_service');
  return res;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.redirect(appUrl('/login'));

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.redirect(appUrl('/login'));

    const url = new URL(req.url);
    const returnedState = url.searchParams.get('state');
    const storedState = req.cookies.get('gmail_oauth_state')?.value;

    if (!returnedState || !storedState || returnedState !== storedState) {
      console.error('Google OAuth CSRF state mismatch');
      return clearCookies(NextResponse.redirect(appUrl('/')));
    }

    const error = url.searchParams.get('error');
    if (error) {
      console.error('Google auth error:', error);
      return clearCookies(NextResponse.redirect(appUrl('/')));
    }

    const code = url.searchParams.get('code');
    if (!code) return clearCookies(NextResponse.redirect(appUrl('/')));

    // Which Google service triggered this callback?
    const service = req.cookies.get('google_oauth_service')?.value || 'gmail';

    if (service === 'youtube') {
      // ── YouTube flow ──────────────────────────────────────────────────────
      const redirectUri = process.env.GMAIL_REDIRECT_URI || appUrl('/api/gmail/auth/callback');
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        redirectUri
      );
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      const channelRes = await youtube.channels.list({ part: ['snippet'], mine: true });
      const channelTitle = channelRes.data.items?.[0]?.snippet?.title || 'YouTube';

      const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;
      await saveOAuthTokens(user.id, 'youtube', channelTitle, tokens.access_token!, tokens.refresh_token ?? undefined, expiresAt);

      return clearCookies(NextResponse.redirect(appUrl('/?youtube_connected=true')));
    }

    // ── Gmail flow (default) ──────────────────────────────────────────────
    const tokens = await getTokensFromCode(code);
    const profile = await getGmailProfile(tokens.accessToken);

    const encryptedAccessToken = encrypt(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken ? encrypt(tokens.refreshToken) : null;

    await prisma.oAuthAccount.upsert({
      where: { userId_provider: { userId: user.id, provider: 'gmail' } },
      update: { providerUserId: profile.emailAddress, accessToken: encryptedAccessToken, refreshToken: encryptedRefreshToken, expiresAt: tokens.expiresAt },
      create: { userId: user.id, provider: 'gmail', providerUserId: profile.emailAddress, accessToken: encryptedAccessToken, refreshToken: encryptedRefreshToken, expiresAt: tokens.expiresAt },
    });

    initializeGmailTools(toolRegistry);

    return clearCookies(NextResponse.redirect(appUrl('/?gmail_connected=true')));
  } catch (err: any) {
    console.error('Error in Google OAuth callback:', err);
    return clearCookies(NextResponse.redirect(appUrl('/')));
  }
}
