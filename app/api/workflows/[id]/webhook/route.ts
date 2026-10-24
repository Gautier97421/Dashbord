/**
 * Inbound webhook for a workflow.
 *
 * POST /api/workflows/[id]/webhook?token=...  — external callers trigger the
 *   workflow; the JSON body is passed as input (available as {{body.*}} in nodes).
 *
 * GET  /api/workflows/[id]/webhook            — the authenticated owner retrieves
 *   the full webhook URL (with token) to paste into the external service.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireFeature, userHasFeature } from '@/lib/features';
import { prisma } from '@/lib/prisma';
import { executeWorkflow } from '@/lib/ai-agent/workflow-runner';
import { sameSecret, workflowWebhookToken } from '@/lib/webhook-token';
import { WorkflowConfig } from '@/lib/types/workflow';
import { AI_QUOTA_MESSAGE, takeAiQuota } from '@/lib/rate-limit';

function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path}`;
}

// Owner retrieves the webhook URL
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFeature('ai-agent');
  if (denied) return denied;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { id } = await params;
  const wf = await prisma.workflow.findFirst({ where: { id, userId: user.id } });
  if (!wf) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const token = workflowWebhookToken(id);
  return NextResponse.json({ url: appUrl(`/api/workflows/${id}/webhook?token=${token}`) });
}

// External trigger
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get('token');
  if (!sameSecret(token, workflowWebhookToken(id))) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const wf = await prisma.workflow.findUnique({ where: { id } });
  if (!wf) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await userHasFeature(wf.userId, 'ai-agent'))) {
    return NextResponse.json({ error: 'Fonctionnalité désactivée' }, { status: 403 });
  }
  if (!takeAiQuota(wf.userId)) return NextResponse.json({ error: AI_QUOTA_MESSAGE }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const config = wf.config as unknown as WorkflowConfig;

  try {
    const result = await executeWorkflow(wf.userId, wf.id, config, { trigger: 'webhook', body });
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    console.error('Webhook workflow execution failed:', error);
    return NextResponse.json({ ok: false, error: 'execution error' }, { status: 500 });
  }
}
