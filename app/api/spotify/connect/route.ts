import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateState, setCsrfCookie, appUrl } from '@/lib/oauth-helpers';

const SCOPES = [
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-top-read',
  'user-read-playback-state',
].join(' ');

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.redirect(appUrl('/login'));
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Spotify not configured' }, { status: 503 });
  }

  const state = generateState();
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || appUrl('/api/spotify/auth/callback');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  const response = NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
  setCsrfCookie(response, 'spotify_oauth_state', state);
  return response;
}
