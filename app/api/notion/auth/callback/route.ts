import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveOAuthTokens, appUrl } from '@/lib/oauth-helpers';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stored = req.cookies.get('notion_oauth_state')?.value;
  const clear = (r: NextResponse) => { r.cookies.delete('notion_oauth_state'); return r; };

  if (!state || state !== stored) return clear(NextResponse.redirect(appUrl('/?service_error=notion_state')));
  if (!code) return clear(NextResponse.redirect(appUrl('/?service_error=notion_no_code')));

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return clear(NextResponse.redirect(appUrl('/login')));

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const clientId = process.env.NOTION_CLIENT_ID!;
    const clientSecret = process.env.NOTION_CLIENT_SECRET!;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basic}` },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: appUrl('/api/notion/auth/callback'),
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('Notion token exchange failed');

    const workspace = tokens.workspace_name || 'Notion';
    await saveOAuthTokens(user.id, 'notion', workspace, tokens.access_token);
    return clear(NextResponse.redirect(appUrl('/?notion_connected=true')));
  } catch (err) {
    console.error('Notion OAuth callback error:', err);
    return clear(NextResponse.redirect(appUrl('/?service_error=notion_auth_failed')));
  }
}
