import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, getSessionUser, parseDay, unauthorized } from '@/lib/projects/server'
import { parseMoney } from '@/lib/budget'
import { monthlyCost } from '@/lib/subscription-billing'

const DEFAULT_SETTINGS = { period: 'monthly', amount: null as number | null, includeSubscriptions: true }

/**
 * GET /api/budget?from=AAAA-MM-JJ&to=AAAA-MM-JJ
 *   Réglages, catégories, dépenses et revenus de la période, et coût mensuel des abonnements actifs.
 */
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const params = new URL(request.url).searchParams
  const from = parseDay(params.get('from'))
  const to = parseDay(params.get('to'))
  if (!from || !to || from > to) return badRequest('Période invalide')

  const [settings, categories, entries, subscriptions] = await Promise.all([
    prisma.budgetSettings.findUnique({ where: { userId: user.id } }),
    prisma.budgetCategory.findMany({ where: { userId: user.id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
    prisma.budgetEntry.findMany({ where: { userId: user.id, date: { gte: from, lte: to } }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] }),
    prisma.subscription.findMany({
      where: { userId: user.id, dismissedAt: null, status: { in: ['active', 'trial'] } },
      select: { id: true, service: true, amount: true, frequency: true },
    }),
  ])

  const subscriptionItems = subscriptions
    .map((s) => ({ id: s.id, service: s.service, monthly: monthlyCost(s.amount, s.frequency) }))
    .filter((s): s is { id: string; service: string; monthly: number } => s.monthly != null)
    .sort((a, b) => b.monthly - a.monthly)

  return NextResponse.json({
    settings: settings
      ? { period: settings.period, amount: settings.amount, includeSubscriptions: settings.includeSubscriptions }
      : DEFAULT_SETTINGS,
    categories: categories.map(({ userId, ...c }) => c),
    entries: entries.map(({ userId, ...e }) => e),
    subscriptions: {
      monthlyTotal: Math.round(subscriptionItems.reduce((sum, s) => sum + s.monthly, 0) * 100) / 100,
      items: subscriptionItems,
    },
  })
}

// PUT /api/budget { period?, amount?, includeSubscriptions? } — réglages
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))

  const data: { period?: string; amount?: number | null; includeSubscriptions?: boolean } = {}
  if (body.period === 'monthly' || body.period === 'weekly') data.period = body.period
  if (body.amount === null || body.amount === '') data.amount = null
  else if (body.amount !== undefined) {
    const amount = parseMoney(body.amount)
    if (amount == null || amount < 0) return badRequest('Montant invalide')
    data.amount = amount
  }
  if (typeof body.includeSubscriptions === 'boolean') data.includeSubscriptions = body.includeSubscriptions

  const settings = await prisma.budgetSettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...DEFAULT_SETTINGS, ...data },
  })
  return NextResponse.json({ period: settings.period, amount: settings.amount, includeSubscriptions: settings.includeSubscriptions })
}
