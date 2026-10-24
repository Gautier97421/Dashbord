/**
 * GET /api/subscriptions — list the user's detected subscriptions.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeEuroAmount } from '@/lib/subscription-billing';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const subs = await prisma.subscription.findMany({
    where: { userId: user.id, dismissedAt: null },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });

  // Liens vers les mails : passent par /mail, qui retrouve la conversation Gmail au moment du clic
  return NextResponse.json(
    subs.map((s) => ({
      ...s,
      emailUrl: s.lastEmailId ? `/api/subscriptions/${s.id}/mail?kind=status` : null,
      invoiceUrl: s.invoiceEmailId && s.invoiceEmailId !== s.lastEmailId ? `/api/subscriptions/${s.id}/mail?kind=invoice` : null,
    }))
  );
}

/**
 * POST /api/subscriptions — ajouter manuellement un abonnement.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await request.json();
  const { service, amount, nextBillingDate, frequency, status, notes } = body;

  if (!service || typeof service !== 'string' || !service.trim()) {
    return NextResponse.json({ error: 'Le nom du service est requis' }, { status: 400 });
  }

  const existing = await prisma.subscription.findUnique({
    where: { userId_service: { userId: user.id, service: service.trim() } },
  });
  if (existing && !existing.dismissedAt) {
    return NextResponse.json({ error: 'Un abonnement avec ce nom existe déjà' }, { status: 400 });
  }

  const euroAmount = normalizeEuroAmount(amount);
  const data = {
    service: service.trim(),
    status: status || 'active',
    amount: euroAmount,
    amountSource: euroAmount ? 'manual' : null,
    editedAt: new Date(),
    nextBillingDate: nextBillingDate ? new Date(nextBillingDate) : null,
    frequency: frequency || null,
    notes: notes || null,
  };
  // Ajout manuel d'un service écarté auparavant : on le réactive
  const sub = existing
    ? await prisma.subscription.update({ where: { id: existing.id }, data: { ...data, dismissedAt: null } })
    : await prisma.subscription.create({ data: { userId: user.id, ...data } });
  return NextResponse.json(sub, { status: 201 });
}
