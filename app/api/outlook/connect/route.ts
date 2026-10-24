import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateState, setCsrfCookie, appUrl } from '@/lib/oauth-helpers';
import { OUTLOOK_AUTHORIZE_URL, OUTLOOK_SCOPES } from '@/lib/integrations/outlook';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.redirect(appUrl('/login'));

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'Outlook not configured (MICROSOFT_CLIENT_ID)' }, { status: 503 });

  const state = generateState();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    response_mode: 'query',
    redirect_uri: appUrl('/api/outlook/auth/callback'),
    scope: OUTLOOK_SCOPES,
    prompt: 'select_account',
    state,
  });
  const response = NextResponse.redirect(`${OUTLOOK_AUTHORIZE_URL}?${params}`);
  setCsrfCookie(response, 'outlook_oauth_state', state);
  return response;
}
