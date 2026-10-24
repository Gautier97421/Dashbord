import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import { generateState, setCsrfCookie, appUrl } from '@/lib/oauth-helpers';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.redirect(appUrl('/login'));

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 503 });
  }

  // Reuse the Gmail redirect URI (already registered in Google Cloud Console)
  const redirectUri = process.env.GMAIL_REDIRECT_URI || appUrl('/api/gmail/auth/callback');
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const state = generateState();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.readonly'],
    prompt: 'consent',
    state,
  });

  const response = NextResponse.redirect(url);
  // Use the same state cookie name as Gmail so the callback validates it
  setCsrfCookie(response, 'gmail_oauth_state', state);
  // Tell the callback which service this is for
  const isHttps = process.env.NEXTAUTH_URL?.startsWith('https') ?? false;
  response.cookies.set('google_oauth_service', 'youtube', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
