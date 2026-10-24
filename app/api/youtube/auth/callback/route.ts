import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';
import { saveOAuthTokens, appUrl } from '@/lib/oauth-helpers';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = req.cookies.get('youtube_oauth_state')?.value;

  const clearCookie = (res: NextResponse) => { res.cookies.delete('youtube_oauth_state'); return res; };

  if (!state || !storedState || state !== storedState) {
    return clearCookie(NextResponse.redirect(appUrl('/?service_error=youtube_state')));
  }
  if (!code) return clearCookie(NextResponse.redirect(appUrl('/?service_error=youtube_no_code')));

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return clearCookie(NextResponse.redirect(appUrl('/login')));

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const redirectUri = appUrl('/api/youtube/auth/callback');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get YouTube channel info to get user identifier
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelRes = await youtube.channels.list({ part: ['snippet'], mine: true });
    const channelId = channelRes.data.items?.[0]?.id || 'unknown';
    const channelTitle = channelRes.data.items?.[0]?.snippet?.title || 'YouTube';

    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;
    await saveOAuthTokens(user.id, 'youtube', channelTitle, tokens.access_token!, tokens.refresh_token ?? undefined, expiresAt);

    return clearCookie(NextResponse.redirect(appUrl('/?youtube_connected=true')));
  } catch (err) {
    console.error('YouTube OAuth callback error:', err);
    return clearCookie(NextResponse.redirect(appUrl('/?service_error=youtube_auth_failed')));
  }
}
