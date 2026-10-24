import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateState, setCsrfCookie, appUrl } from '@/lib/oauth-helpers';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.redirect(appUrl('/login'));

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'LinkedIn not configured' }, { status: 503 });

  const state = generateState();
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || appUrl('/api/linkedin/auth/callback');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'r_liteprofile r_emailaddress',
    state,
  });

  const response = NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
  setCsrfCookie(response, 'linkedin_oauth_state', state);
  return response;
}
