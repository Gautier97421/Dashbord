import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveOAuthTokens, appUrl } from '@/lib/oauth-helpers';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stored = req.cookies.get('discord_oauth_state')?.value;
  const clear = (r: NextResponse) => { r.cookies.delete('discord_oauth_state'); return r; };

  if (!state || state !== stored) return clear(NextResponse.redirect(appUrl('/?service_error=discord_state')));
  if (!code) return clear(NextResponse.redirect(appUrl('/?service_error=discord_no_code')));

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return clear(NextResponse.redirect(appUrl('/login')));

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const redirectUri = appUrl('/api/discord/auth/callback');
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('Discord token exchange failed');

    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = await meRes.json();
    const username = me.global_name || me.username || 'Discord';

    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined;
    await saveOAuthTokens(user.id, 'discord', username, tokens.access_token, tokens.refresh_token, expiresAt);
    return clear(NextResponse.redirect(appUrl('/?discord_connected=true')));
  } catch (err) {
    console.error('Discord OAuth callback error:', err);
    return clear(NextResponse.redirect(appUrl('/?service_error=discord_auth_failed')));
  }
}
