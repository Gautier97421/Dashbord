/**
 * GET  /api/watches — list the user's product watches
 * POST /api/watches — create one  { label, url, type, targetPrice? }
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function currentUser(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await currentUser(session.user.email);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const watches = await prisma.watch.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(watches);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await currentUser(session.user.email);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const url = (body.url || '').toString().trim();
  const label = (body.label || '').toString().trim().slice(0, 120) || 'Produit';
  const type = body.type === 'price' ? 'price' : 'restock';
  const targetPrice = type === 'price' && body.targetPrice ? Number(body.targetPrice) : null;

  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'URL invalide (doit commencer par http)' }, { status: 400 });
  }
  if (type === 'price' && (targetPrice == null || !Number.isFinite(targetPrice))) {
    return NextResponse.json({ error: 'Prix cible requis' }, { status: 400 });
  }

  const watch = await prisma.watch.create({
    data: { userId: user.id, label, url, type: type as any, targetPrice },
  });
  return NextResponse.json(watch, { status: 201 });
}
