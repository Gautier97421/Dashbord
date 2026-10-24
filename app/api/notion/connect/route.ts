import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateState, setCsrfCookie, appUrl } from '@/lib/oauth-helpers';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.redirect(appUrl('/login'));

  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'Notion not configured' }, { status: 503 });

  const state = generateState();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    owner: 'user',
    redirect_uri: appUrl('/api/notion/auth/callback'),
    state,
  });
  const response = NextResponse.redirect(`https://api.notion.com/v1/oauth/authorize?${params}`);
  setCsrfCookie(response, 'notion_oauth_state', state);
  return response;
}
