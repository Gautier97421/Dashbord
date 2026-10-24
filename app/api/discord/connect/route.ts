import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateState, setCsrfCookie, appUrl } from '@/lib/oauth-helpers';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.redirect(appUrl('/login'));

  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'Discord not configured' }, { status: 503 });

  const state = generateState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: appUrl('/api/discord/auth/callback'),
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });
  const response = NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  setCsrfCookie(response, 'discord_oauth_state', state);
  return response;
}
