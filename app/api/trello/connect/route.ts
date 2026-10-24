import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { appUrl } from '@/lib/oauth-helpers';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.redirect(appUrl('/login'));

  const key = process.env.TRELLO_API_KEY;
  if (!key) return NextResponse.json({ error: 'Trello not configured' }, { status: 503 });

  const params = new URLSearchParams({
    expiration: 'never',
    scope: 'read',
    name: 'Dashlife',
    response_type: 'token',
    key,
    return_url: appUrl('/api/trello/auth/callback'),
  });
  return NextResponse.redirect(`https://trello.com/1/authorize?${params}`);
}
