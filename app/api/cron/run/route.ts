/**
 * POST /api/cron/run
 *
 * Scheduler entry point. Runs every active workflow that has an automatic
 * trigger (scheduled / email_received). Meant to be hit periodically by an
 * external cron (Fly.io scheduled machine, GitHub Action, cron-job.org, etc).
 *
 * Protected by a bearer token: set CRON_SECRET in the environment and call with
 *   Authorization: Bearer <CRON_SECRET>
 *
 * This route is NOT a user session route — it runs workflows for all users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { executeWorkflow } from '@/lib/ai-agent/workflow-runner';
import { runAgentForUser } from '@/lib/ai-agent/agent';
import { featureUserFilter } from '@/lib/features';
import { WorkflowConfig } from '@/lib/types/workflow';
import { runProjectAlertsForAllUsers } from '@/lib/projects/alerts-runner';
import { purgeExpiredTrash } from '@/lib/projects/server';
import { refreshWishlistsForAllUsers } from '@/lib/wishlist/server';
import { runTripAlertsForAllUsers } from '@/lib/travel/server';
import { sameSecret } from '@/lib/webhook-token';

// Trigger types that should fire automatically (no manual click)
const AUTO_TRIGGERS = new Set(['scheduled', 'email_received']);

export async function POST(req: NextRequest) {
  // 1. Authenticate the cron caller
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }

  const auth = req.headers.get('authorization');
  if (!sameSecret(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Find active workflows
  //    (si l'admin a désactivé l'Agent IA, seuls ses propres workflows tournent)
  const workflows = await prisma.workflow.findMany({
    where: { isActive: true, ...(await featureUserFilter('ai-agent')) },
  });

  const results: Array<{ workflowId: string; trigger: string; status: string; error?: string }> = [];

  for (const workflow of workflows) {
    const config = workflow.config as unknown as WorkflowConfig;
    const nodes = config?.nodes || [];

    // A workflow can have several triggers: fire each automatic trigger type it contains
    const autoTypes = [
      ...new Set(
        nodes
          .filter((n) => n.type === 'trigger')
          .map((n) => (n.data.config as any)?.type as string)
          .filter((type) => AUTO_TRIGGERS.has(type))
      ),
    ];

    for (const triggerType of autoTypes) {
      try {
        const result = await executeWorkflow(workflow.userId, workflow.id, config, {
          trigger: triggerType,
          firedAt: new Date().toISOString(),
        });
        results.push({ workflowId: workflow.id, trigger: triggerType, status: result.status, error: result.error });
      } catch (error) {
        console.error(`Cron failed for workflow ${workflow.id}:`, error);
        results.push({
          workflowId: workflow.id,
          trigger: triggerType,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  // 3. Run the autonomous agent for every user who enabled it
  const agentResults: Array<{ userId: string; ok: boolean; notified?: number; error?: string }> = [];
  const enabledConfigs = await prisma.agentConfig.findMany({
    where: { enabled: true, ...(await featureUserFilter('ai-agent')) },
  });
  for (const cfg of enabledConfigs) {
    try {
      const r = await runAgentForUser(cfg.userId);
      agentResults.push({ userId: cfg.userId, ok: r.ok, notified: r.notified, error: r.error });
    } catch (error) {
      agentResults.push({ userId: cfg.userId, ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // 4. Alertes des projets (retards, échéances, blocages…) → notifications et push, puis corbeille expirée
  let projectAlerts: Awaited<ReturnType<typeof runProjectAlertsForAllUsers>> = [];
  try {
    projectAlerts = await runProjectAlertsForAllUsers();
    await purgeExpiredTrash();
  } catch (error) {
    console.error('Cron project alerts failed:', error);
  }

  // 5. Wishlist : prix relus une fois par jour, alerte en cas de baisse
  let wishlistRefreshed = 0;
  try {
    wishlistRefreshed = await refreshWishlistsForAllUsers();
  } catch (error) {
    console.error('Cron wishlist refresh failed:', error);
  }

  // 6. Voyages : échéances des préparatifs, enregistrement en ligne, départ vers la gare ou l'aéroport
  let tripAlerts = 0;
  try {
    tripAlerts = await runTripAlertsForAllUsers();
  } catch (error) {
    console.error('Cron trip alerts failed:', error);
  }

  return NextResponse.json({
    ran: results.length,
    results,
    agent: agentResults,
    projectAlerts: projectAlerts.filter((r) => r.created || r.error),
    wishlistRefreshed,
    tripAlerts,
    timestamp: new Date().toISOString(),
  });
}
