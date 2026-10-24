import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateState, setCsrfCookie, appUrl } from '@/lib/oauth-helpers';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.redirect(appUrl('/login'));

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'GitHub not configured' }, { status: 503 });

  const state = generateState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: appUrl('/api/github/auth/callback'),
    scope: 'notifications repo read:user',
    state,
  });
  const response = NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`);
  setCsrfCookie(response, 'github_oauth_state', state);
  return response;
}
