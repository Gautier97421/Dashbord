import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveOAuthTokens, appUrl } from '@/lib/oauth-helpers';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stored = req.cookies.get('github_oauth_state')?.value;
  const clear = (r: NextResponse) => { r.cookies.delete('github_oauth_state'); return r; };

  if (!state || state !== stored) return clear(NextResponse.redirect(appUrl('/?service_error=github_state')));
  if (!code) return clear(NextResponse.redirect(appUrl('/?service_error=github_no_code')));

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return clear(NextResponse.redirect(appUrl('/login')));

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: appUrl('/api/github/auth/callback'),
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('GitHub token exchange failed');

    const profileRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/vnd.github+json' },
    });
    const profile = await profileRes.json();

    await saveOAuthTokens(user.id, 'github', profile.login || 'GitHub', tokens.access_token);
    return clear(NextResponse.redirect(appUrl('/?github_connected=true')));
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    return clear(NextResponse.redirect(appUrl('/?service_error=github_auth_failed')));
  }
}
