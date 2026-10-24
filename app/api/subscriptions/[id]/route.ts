/**
 * DELETE /api/subscriptions/[id] — remove a tracked subscription.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeEuroAmount } from '@/lib/subscription-billing';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { id } = await params;
  const sub = await prisma.subscription.findFirst({ where: { id, userId: user.id } });
  if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Un abonnement détecté dans les mails est seulement écarté, sinon le prochain scan le recréerait
  if (sub.lastEmailId) {
    await prisma.subscription.update({ where: { id }, data: { dismissedAt: new Date() } });
  } else {
    await prisma.subscription.delete({ where: { id } });
  }
  return NextResponse.json({ success: true });
}

/**
 * PUT /api/subscriptions/[id] — modifier un abonnement (ajout manuel ou détecté).
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { id } = await params;
  const existing = await prisma.subscription.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const { service, amount, nextBillingDate, frequency, status, notes } = body;

  if (!service || typeof service !== 'string' || !service.trim()) {
    return NextResponse.json({ error: 'Le nom du service est requis' }, { status: 400 });
  }

  // Toujours en euros, au format "9,99 €"
  const euroAmount = normalizeEuroAmount(amount);
  const sub = await prisma.subscription.update({
    where: { id },
    data: {
      service: service.trim(),
      status: status || existing.status,
      amount: euroAmount,
      // Un prix changé à la main devient prioritaire sur les factures lues par le scan
      amountSource: euroAmount !== existing.amount ? (euroAmount ? 'manual' : null) : existing.amountSource,
      editedAt: new Date(),
      nextBillingDate: nextBillingDate ? new Date(nextBillingDate) : null,
      frequency: frequency || null,
      notes: notes || null,
    },
  });
  return NextResponse.json(sub);
}
