import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveOAuthTokens, appUrl } from '@/lib/oauth-helpers';

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.redirect(appUrl('/?service_error=trello_no_token'));

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.redirect(appUrl('/login'));

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    // Verify the token + get the member name
    const key = process.env.TRELLO_API_KEY!;
    let name = 'Trello';
    try {
      const meRes = await fetch(`https://api.trello.com/1/members/me?key=${key}&token=${token}`);
      if (meRes.ok) {
        const me = await meRes.json();
        name = me.fullName || me.username || 'Trello';
      }
    } catch { /* ignore */ }

    await saveOAuthTokens(user.id, 'trello', name, token);
    return NextResponse.redirect(appUrl('/?trello_connected=true'));
  } catch (err) {
    console.error('Trello save error:', err);
    return NextResponse.redirect(appUrl('/?service_error=trello_auth_failed'));
  }
}
