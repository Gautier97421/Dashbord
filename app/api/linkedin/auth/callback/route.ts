import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveOAuthTokens, appUrl } from '@/lib/oauth-helpers';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = req.cookies.get('linkedin_oauth_state')?.value;

  const clearCookie = (res: NextResponse) => { res.cookies.delete('linkedin_oauth_state'); return res; };

  if (!state || !storedState || state !== storedState) {
    return clearCookie(NextResponse.redirect(appUrl('/?service_error=linkedin_state')));
  }
  if (!code) return clearCookie(NextResponse.redirect(appUrl('/?service_error=linkedin_no_code')));

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return clearCookie(NextResponse.redirect(appUrl('/login')));

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const clientId = process.env.LINKEDIN_CLIENT_ID!;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI || appUrl('/api/linkedin/auth/callback');

    // Exchange code for tokens
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
    });
    if (!tokenRes.ok) throw new Error('LinkedIn token exchange failed');
    const tokens = await tokenRes.json();

    // Get LinkedIn profile
    const profileRes = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName)', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    const displayName = `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim() || profile.id;

    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined;
    await saveOAuthTokens(user.id, 'linkedin', displayName, tokens.access_token, undefined, expiresAt);

    return clearCookie(NextResponse.redirect(appUrl('/?linkedin_connected=true')));
  } catch (err) {
    console.error('LinkedIn OAuth callback error:', err);
    return clearCookie(NextResponse.redirect(appUrl('/?service_error=linkedin_auth_failed')));
  }
}
