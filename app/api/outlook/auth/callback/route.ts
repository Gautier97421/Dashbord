import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveOAuthTokens, appUrl } from '@/lib/oauth-helpers';
import { exchangeOutlookToken, getOutlookAddress } from '@/lib/integrations/outlook';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stored = req.cookies.get('outlook_oauth_state')?.value;
  const clear = (r: NextResponse) => { r.cookies.delete('outlook_oauth_state'); return r; };

  if (!state || state !== stored) return clear(NextResponse.redirect(appUrl('/?service_error=outlook_state')));
  if (!code) return clear(NextResponse.redirect(appUrl('/?service_error=outlook_no_code')));

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return clear(NextResponse.redirect(appUrl('/login')));

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const tokens = await exchangeOutlookToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: appUrl('/api/outlook/auth/callback'),
    });
    const address = await getOutlookAddress(tokens.access_token);

    await saveOAuthTokens(
      user.id,
      'outlook',
      address,
      tokens.access_token,
      tokens.refresh_token,
      new Date(Date.now() + tokens.expires_in * 1000)
    );
    return clear(NextResponse.redirect(appUrl('/?outlook_connected=true')));
  } catch (err) {
    console.error('Outlook OAuth callback error:', err);
    return clear(NextResponse.redirect(appUrl('/?service_error=outlook_auth_failed')));
  }
}
