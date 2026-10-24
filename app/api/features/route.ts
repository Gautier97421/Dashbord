/**
 * GET   /api/features — accès de l'utilisateur courant (+ état global pour l'admin)
 * PATCH /api/features — admin uniquement. Body: { key, enabled }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FEATURE_KEYS, isFeatureKey } from '@/lib/feature-defs';
import { getFeatureFlags, isAdminEmail } from '@/lib/features';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = isAdminEmail(session.user.email);
  const flags = await getFeatureFlags();
  const access = Object.fromEntries(FEATURE_KEYS.map((key) => [key, isAdmin || flags[key]]));

  return NextResponse.json({ isAdmin, access, ...(isAdmin && { flags }) });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (!isFeatureKey(body.key) || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'key ou enabled invalide' }, { status: 400 });
  }

  await prisma.featureFlag.upsert({
    where: { key: body.key },
    create: { key: body.key, enabled: body.enabled },
    update: { enabled: body.enabled },
  });

  return NextResponse.json({ flags: await getFeatureFlags() });
}
