import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuthorizationUrl } from '@/lib/gmail/oauth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      // Redirect to login instead of returning JSON so the browser flow works
      const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
      return NextResponse.redirect(`${base}/login`);
    }

    const { url, state } = getAuthorizationUrl();

    const response = NextResponse.redirect(url);

    const isHttps = process.env.NEXTAUTH_URL?.startsWith('https') ?? false;
    response.cookies.set('gmail_oauth_state', state, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Error in /api/gmail/connect:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Gmail auth' },
      { status: 500 }
    );
  }
}
