import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveOAuthTokens, appUrl } from '@/lib/oauth-helpers';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = req.cookies.get('spotify_oauth_state')?.value;

  const clearCookie = (res: NextResponse) => { res.cookies.delete('spotify_oauth_state'); return res; };

  if (!state || !storedState || state !== storedState) {
    return clearCookie(NextResponse.redirect(appUrl('/?service_error=spotify_state')));
  }

  if (!code) {
    return clearCookie(NextResponse.redirect(appUrl('/?service_error=spotify_no_code')));
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return clearCookie(NextResponse.redirect(appUrl('/login')));
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const clientId = process.env.SPOTIFY_CLIENT_ID!;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || appUrl('/api/spotify/auth/callback');

    // Exchange code for tokens
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });

    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const tokens = await tokenRes.json();

    // Get Spotify user profile
    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    await saveOAuthTokens(user.id, 'spotify', profile.id || profile.email, tokens.access_token, tokens.refresh_token, expiresAt);

    return clearCookie(NextResponse.redirect(appUrl('/?spotify_connected=true')));
  } catch (err) {
    console.error('Spotify OAuth callback error:', err);
    return clearCookie(NextResponse.redirect(appUrl('/?service_error=spotify_auth_failed')));
  }
}
