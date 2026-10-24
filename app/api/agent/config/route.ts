/**
 * GET/PUT /api/agent/config — read or update the autonomous agent settings.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireFeature } from '@/lib/features';
import { prisma } from '@/lib/prisma';
import { getOrCreateAgentConfig } from '@/lib/ai-agent/agent';

async function currentUser(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function GET() {
  const denied = await requireFeature('ai-agent');
  if (denied) return denied;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await currentUser(session.user.email);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const config = await getOrCreateAgentConfig(user.id);
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const denied = await requireFeature('ai-agent');
  if (denied) return denied;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await currentUser(session.user.email);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await getOrCreateAgentConfig(user.id);
  const body = await request.json().catch(() => ({}));

  const data: Record<string, any> = {};
  for (const key of ['enabled', 'sortSubscriptions', 'detectCancellations', 'notifyImportant', 'trackApplications', 'forwardToDiscord', 'safeMode']) {
    if (typeof body[key] === 'boolean') data[key] = body[key];
  }
  if (typeof body.discordWebhookUrl === 'string') {
    data.discordWebhookUrl = body.discordWebhookUrl.trim() || null;
  }
  if (Array.isArray(body.rules)) {
    // sanitize each rule
    data.rules = body.rules.slice(0, 50).map((r: any) => ({
      id: String(r.id || Math.random().toString(36).slice(2)),
      field: ['from', 'subject', 'body', 'any'].includes(r.field) ? r.field : 'any',
      op: r.op === 'equals' ? 'equals' : 'contains',
      value: String(r.value || '').slice(0, 200),
      action: ['important', 'label', 'ignore'].includes(r.action) ? r.action : 'important',
      label: r.label ? String(r.label).slice(0, 60) : undefined,
    })) as any;
  }

  const config = await prisma.agentConfig.update({ where: { userId: user.id }, data });
  return NextResponse.json(config);
}
