/**
 * Workflow runner — the real execution engine.
 *
 * Traverses the workflow GRAPH by following edges from the trigger node(s), so the
 * visual connections (and conditional branches) actually drive execution.
 *
 * Logic nodes:
 *   - filter   : stop the current branch if the condition is not met
 *   - if_then  : follow the "true" or "false" outgoing edges based on a condition
 *   - delay    : pause before continuing
 *   - transform: write a templated value into the data
 *   - code     : user JavaScript, run in a QuickJS sandbox
 *
 * Action nodes:
 *   - gmail_read / gmail_label / gmail_move / gmail_send / gmail_delete
 *   - gmail_classify    : AI triage of emails (Ollama)
 *   - calendar_create   : extract meetings from emails into the agenda (Ollama)
 *   - track_application : detect job-application confirmation emails (Ollama)
 *   - outlook_read / outlook_send / outlook_move (Microsoft Graph)
 *   - http_request, discord_send, slack_send, telegram_send, notion_create,
 *     github_issue, trello_card, notify
 *
 * Used by the manual execute route, the cron scheduler, and the Gmail push webhook.
 */

import { prisma } from '../prisma';
import { getGmailClientForUser, GmailNotConnectedError } from '../gmail/get-client';
import { GmailClient } from '../gmail/client';
import { classifyEmails, extractCalendarEvent, detectJobApplication, EmailMeta } from './email-intelligence';
import { WorkflowConfig, WorkflowNode } from '../types/workflow';
import { postToDiscordWebhook } from '../integrations/discord';
import { createNotionNote } from '../integrations';
import { outlookListMessages, outlookMoveMessages, outlookSendMail } from '../integrations/outlook';
import { createGitHubIssue, createTrelloCard, postToSlackWebhook, sendTelegramMessage } from '../integrations/actions';
import { runUserCode } from '../sandbox/run-code';
import { createNotification } from '../notifications';
import { stagePendingAction } from './pending';
import { safeRequest } from '../security/safe-fetch';

/**
 * Replace {{ path }} placeholders in a string with values from the workflow
 * output context (dot-path supported). Enables chaining nodes, n8n-style.
 */
function interpolate(template: string | undefined, output: Record<string, any>): string {
  if (!template || typeof template !== 'string') return template || '';
  return template.replace(/\{\{\s*([\w.[\]]+)\s*\}\}/g, (_m, path: string) => {
    const value = path
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .reduce((acc: any, key: string) => (acc == null ? acc : acc[key]), output);
    if (value === undefined || value === null) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}

export interface WorkflowRunResult {
  executionId: string;
  status: 'success' | 'failed';
  output: Record<string, any>;
  logs: any[];
  error?: string;
}

interface LogEntry {
  nodeId: string;
  status: 'success' | 'failed' | 'skipped';
  message: string;
}

const MAX_STEPS = 100; // safety bound against cycles

export async function executeWorkflow(
  userId: string,
  workflowId: string,
  config: WorkflowConfig,
  input: Record<string, any> = {}
): Promise<WorkflowRunResult> {
  const execution = await prisma.workflowExecution.create({
    data: { workflowId, status: 'running', input: input as any, logs: [] },
  });

  const output: Record<string, any> = { ...input };
  const logs: LogEntry[] = [];

  const nodes = config.nodes || [];
  const edges = config.edges || [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Outgoing edges grouped by source node id
  const outgoing = new Map<string, { target: string; handle?: string }[]>();
  for (const e of edges) {
    const list = outgoing.get(e.source) || [];
    list.push({ target: e.target, handle: (e as any).sourceHandle || undefined });
    outgoing.set(e.source, list);
  }

  // Lazily obtain a Gmail client only when an action needs it
  let gmailClient: GmailClient | null = null;
  const getGmail = async (): Promise<GmailClient> => {
    if (!gmailClient) gmailClient = await getGmailClientForUser(userId);
    return gmailClient;
  };

  // Safe mode (default ON): AI never performs irreversible actions — it stages
  // them (Gmail drafts / labels) and notifies instead. Disabled only if the
  // user explicitly turned it off in the agent settings, or overridden by input.
  let safeMode = true;
  if (input.__safeMode === false) {
    safeMode = false;
  } else {
    const cfg = await prisma.agentConfig.findUnique({ where: { userId }, select: { safeMode: true } });
    if (cfg && cfg.safeMode === false) safeMode = false;
  }

  // Entry points: a workflow can have several triggers. Start from the ones matching what
  // fired it (cron / webhook / manual run), otherwise from every trigger. A workflow
  // without any trigger starts from its root nodes.
  const hasIncoming = new Set(edges.map((e) => e.target));
  const triggers = nodes.filter((n) => n.type === 'trigger');
  const firedType = typeof input.trigger === 'string' ? input.trigger : 'manual';
  let entryNodes = triggers.filter((n) => (n.data.config as any)?.type === firedType);
  if (entryNodes.length === 0) entryNodes = triggers;
  if (entryNodes.length === 0) entryNodes = nodes.filter((n) => !hasIncoming.has(n.id));

  try {
    const visited = new Set<string>();
    const queue: string[] = entryNodes.map((n) => n.id);
    let steps = 0;

    while (queue.length > 0) {
      if (++steps > MAX_STEPS) break;

      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = nodeById.get(nodeId);
      if (!node) continue;

      // Execute the node; decide which outgoing handle(s) to follow
      const decision = await executeNode(node, { userId, output, logs, getGmail, safeMode });

      if (decision === 'stop') {
        continue; // dead-end this branch, do not follow edges
      }

      const nexts = outgoing.get(nodeId) || [];
      for (const edge of nexts) {
        // For if_then, only follow edges matching the taken branch handle
        if (decision === 'true' || decision === 'false') {
          const handle = (edge.handle || '').toLowerCase();
          if (handle && handle !== decision) continue;
        }
        if (!visited.has(edge.target)) {
          queue.push(edge.target);
        }
      }
    }

    return await finalize(execution.id, 'success', output, logs);
  } catch (error) {
    return await finalize(
      execution.id,
      'failed',
      output,
      logs,
      error instanceof Error ? error.message : 'Workflow execution failed'
    );
  }
}

type NodeDecision = 'continue' | 'stop' | 'true' | 'false';

interface NodeCtx {
  userId: string;
  output: Record<string, any>;
  logs: LogEntry[];
  getGmail: () => Promise<GmailClient>;
  safeMode: boolean;
}

/**
 * Execute a single node. Returns which branch to follow:
 *   'continue' -> follow all outgoing edges
 *   'stop'     -> dead-end (filter failed / error)
 *   'true'/'false' -> follow edges whose handle matches (if_then)
 */
async function executeNode(node: WorkflowNode, ctx: NodeCtx): Promise<NodeDecision> {
  const { logs } = ctx;

  if (node.type === 'trigger') {
    logs.push({ nodeId: node.id, status: 'success', message: 'Trigger fired' });
    return 'continue';
  }

  try {
    if (node.type === 'logic') {
      return await executeLogicNode(node, ctx);
    }
    if (node.type === 'action') {
      await executeActionNode(node, ctx);
      return 'continue';
    }
  } catch (error) {
    logs.push({
      nodeId: node.id,
      status: 'failed',
      message:
        error instanceof GmailNotConnectedError
          ? 'Gmail not connected'
          : error instanceof Error
            ? error.message
            : 'Unknown error',
    });
    return 'stop';
  }

  return 'continue';
}

async function executeLogicNode(node: WorkflowNode, ctx: NodeCtx): Promise<NodeDecision> {
  const { output, logs } = ctx;
  const logicType = (node.data.config as any).type;
  const params = node.data.parameters || {};

  if (logicType === 'filter') {
    const passed = evaluateCondition(params.field, params.operator, params.value, output);
    logs.push({
      nodeId: node.id,
      status: passed ? 'success' : 'skipped',
      message: passed ? 'Filter passed' : 'Filter condition not met',
    });
    return passed ? 'continue' : 'stop';
  }

  if (logicType === 'if_then') {
    const passed = evaluateIfThen(params.condition, output);
    logs.push({
      nodeId: node.id,
      status: 'success',
      message: `Condition is ${passed ? 'true' : 'false'}`,
    });
    return passed ? 'true' : 'false';
  }

  if (logicType === 'delay') {
    const duration = Math.min(Number(params.duration) || 1000, 10000);
    await new Promise((r) => setTimeout(r, duration));
    logs.push({ nodeId: node.id, status: 'success', message: `Delayed ${duration}ms` });
    return 'continue';
  }

  if (logicType === 'transform') {
    // "key = {{template}}" stores into output[key]; otherwise output.transformed
    const expr: string = params.transformation || '';
    const eqIdx = expr.indexOf('=');
    if (eqIdx > 0) {
      const key = expr.slice(0, eqIdx).trim();
      output[key] = interpolate(expr.slice(eqIdx + 1).trim(), output);
    } else {
      output.transformed = interpolate(expr, output);
    }
    logs.push({ nodeId: node.id, status: 'success', message: 'Transformé' });
    return 'continue';
  }

  if (logicType === 'code') {
    const result = await runUserCode(String(params.code || ''), output);
    // A returned object is merged into the data; any other value is kept as codeResult
    if (result && typeof result === 'object' && !Array.isArray(result)) Object.assign(output, result);
    else if (result !== null && result !== undefined) output.codeResult = result;
    output.last = result;
    logs.push({ nodeId: node.id, status: 'success', message: 'Code exécuté' });
    return 'continue';
  }

  logs.push({ nodeId: node.id, status: 'skipped', message: `Unknown logic: ${logicType}` });
  return 'continue';
}

async function executeActionNode(node: WorkflowNode, ctx: NodeCtx): Promise<void> {
  const { output, logs, userId, getGmail, safeMode } = ctx;
  const actionType = (node.data.config as any).type;
  const params = node.data.parameters || {};

  // ── n8n-style generic nodes (no Gmail required) ──
  if (actionType === 'http_request') {
    const method = (params.method || 'GET').toUpperCase();
    const url = interpolate(params.url, output);
    if (!url) throw new Error('URL requise pour la requête HTTP');
    const isWrite = !['GET', 'HEAD'].includes(method);

    // Safe mode: don't perform external writes (POST/PUT/PATCH/DELETE) automatically
    if (isWrite && safeMode) {
      await stagePendingAction(userId, 'http_request', `Requête ${method} vers ${url}`, {
        method, url, headers: params.headers ? interpolate(params.headers, output) : undefined,
        body: params.body ? interpolate(params.body, output) : undefined,
      });
      logs.push({ nodeId: node.id, status: 'skipped', message: `HTTP ${method} mis en attente (à valider)` });
      return;
    }

    let headers: Record<string, string> = {};
    if (params.headers) {
      try { headers = JSON.parse(interpolate(params.headers, output)); } catch { /* ignore bad JSON */ }
    }
    // Adresses publiques uniquement : le nœud ne doit pas servir à explorer le réseau du serveur
    const res = await safeRequest(url, {
      method,
      headers,
      body: isWrite && params.body ? interpolate(params.body, output) : undefined,
    });
    const text = res.text;
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* keep text */ }
    output.httpStatus = res.status;
    output.httpResponse = data;
    output.last = data;
    logs.push({ nodeId: node.id, status: res.ok ? 'success' : 'failed', message: `HTTP ${method} ${res.status}` });
    return;
  }

  if (actionType === 'discord_send') {
    const message = interpolate(params.message, output);
    if (safeMode) {
      await stagePendingAction(userId, 'discord_send', `Envoyer sur Discord : « ${message.slice(0, 80)} »`, {
        webhookUrl: params.webhookUrl, message,
      });
      logs.push({ nodeId: node.id, status: 'skipped', message: 'Discord mis en attente (à valider)' });
      return;
    }
    const ok = await postToDiscordWebhook(params.webhookUrl, message);
    logs.push({ nodeId: node.id, status: ok ? 'success' : 'failed', message: ok ? 'Message Discord envoyé' : 'Échec Discord (webhook ?)' });
    return;
  }

  if (actionType === 'slack_send') {
    const message = interpolate(params.message, output);
    if (safeMode) {
      await stagePendingAction(userId, 'slack_send', `Envoyer sur Slack : « ${message.slice(0, 80)} »`, {
        webhookUrl: params.webhookUrl, message,
      });
      logs.push({ nodeId: node.id, status: 'skipped', message: 'Slack mis en attente (à valider)' });
      return;
    }
    await postToSlackWebhook(params.webhookUrl, message);
    logs.push({ nodeId: node.id, status: 'success', message: 'Message Slack envoyé' });
    return;
  }

  if (actionType === 'telegram_send') {
    const message = interpolate(params.message, output);
    const chatId = interpolate(params.chatId, output);
    if (safeMode) {
      await stagePendingAction(userId, 'telegram_send', `Envoyer sur Telegram : « ${message.slice(0, 80)} »`, {
        botToken: params.botToken, chatId, message,
      });
      logs.push({ nodeId: node.id, status: 'skipped', message: 'Telegram mis en attente (à valider)' });
      return;
    }
    await sendTelegramMessage(params.botToken, chatId, message);
    logs.push({ nodeId: node.id, status: 'success', message: 'Message Telegram envoyé' });
    return;
  }

  if (actionType === 'notion_create') {
    const title = interpolate(params.title, output);
    const content = interpolate(params.content, output);
    if (safeMode) {
      await stagePendingAction(userId, 'notion_create', `Créer une page Notion : « ${title} »`, { title, content });
      logs.push({ nodeId: node.id, status: 'skipped', message: 'Notion mis en attente (à valider)' });
      return;
    }
    const pageUrl = await createNotionNote(userId, title, content);
    output.notionPageUrl = pageUrl;
    logs.push({ nodeId: node.id, status: 'success', message: 'Page Notion créée' });
    return;
  }

  if (actionType === 'github_issue') {
    const repo = interpolate(params.repo, output).trim();
    const title = interpolate(params.title, output);
    const body = interpolate(params.body, output);
    if (!repo || !title) throw new Error('Dépôt et titre requis');
    if (safeMode) {
      await stagePendingAction(userId, 'github_issue', `Créer une issue GitHub dans ${repo} : « ${title} »`, { repo, title, body });
      logs.push({ nodeId: node.id, status: 'skipped', message: 'Issue GitHub mise en attente (à valider)' });
      return;
    }
    output.githubIssueUrl = await createGitHubIssue(userId, repo, title, body);
    logs.push({ nodeId: node.id, status: 'success', message: 'Issue GitHub créée' });
    return;
  }

  if (actionType === 'trello_card') {
    const listId = interpolate(params.listId, output).trim();
    const name = interpolate(params.name, output);
    const desc = interpolate(params.desc, output);
    if (!listId || !name) throw new Error('Liste et titre requis');
    if (safeMode) {
      await stagePendingAction(userId, 'trello_card', `Créer une carte Trello : « ${name} »`, { listId, name, desc });
      logs.push({ nodeId: node.id, status: 'skipped', message: 'Carte Trello mise en attente (à valider)' });
      return;
    }
    output.trelloCardUrl = await createTrelloCard(userId, listId, name, desc);
    logs.push({ nodeId: node.id, status: 'success', message: 'Carte Trello créée' });
    return;
  }

  if (actionType === 'notify') {
    await createNotification({
      userId, type: 'agent',
      title: interpolate(params.title, output) || 'Notification',
      body: interpolate(params.body, output) || undefined,
      link: 'ai-agent',
    });
    logs.push({ nodeId: node.id, status: 'success', message: 'Notification créée' });
    return;
  }

  // ── Outlook nodes (Microsoft Graph) ──
  if (actionType === 'outlook_read') {
    const emails = await outlookListMessages(userId, {
      search: interpolate(params.search, output),
      folder: params.folder || 'inbox',
      top: Number(params.maxResults) || 10,
    });
    output.outlookEmails = emails;
    output.emails = emails;
    output.last = emails;
    logs.push({ nodeId: node.id, status: 'success', message: `${emails.length} email(s) Outlook lus` });
    return;
  }

  if (actionType === 'outlook_send') {
    const to = interpolate(params.to, output);
    if (!to) throw new Error('Destinataire requis');
    const subject = interpolate(params.subject, output) || '(sans objet)';
    const body = interpolate(params.body, output) || '';
    if (safeMode) {
      await stagePendingAction(userId, 'outlook_send', `Envoyer un email Outlook à ${to} — « ${subject} »`, { to, subject, body });
      logs.push({ nodeId: node.id, status: 'skipped', message: `Email Outlook à ${to} mis en attente (à valider)` });
      return;
    }
    await outlookSendMail(userId, { to, subject, body });
    logs.push({ nodeId: node.id, status: 'success', message: `Email Outlook envoyé à ${to}` });
    return;
  }

  if (actionType === 'outlook_move') {
    const folder = interpolate(params.folder, output).trim();
    if (!folder) throw new Error('Dossier cible requis');
    let ids: string[] = Array.isArray(output.outlookEmails) ? output.outlookEmails.map((e: any) => e.id) : [];
    if (params.search || ids.length === 0) {
      ids = (await outlookListMessages(userId, { search: interpolate(params.search, output), top: 25 })).map((e) => e.id);
    }
    if (ids.length === 0) {
      logs.push({ nodeId: node.id, status: 'skipped', message: 'Aucun email Outlook correspondant' });
      return;
    }
    const moved = await outlookMoveMessages(userId, ids, folder);
    logs.push({ nodeId: node.id, status: 'success', message: `${moved} email(s) Outlook déplacés vers « ${folder} »` });
    return;
  }

  // ── Gmail / calendar / applications nodes (need a Gmail client) ──
  const gmail = await getGmail();

  if (actionType === 'gmail_read') {
    const search = await gmail.searchEmails({
      q: params.query || 'is:unread',
      maxResults: Number(params.maxResults) || 10,
    });
    const ids = (search.messages || []).map((m) => m.id);
    output.messageIds = ids;
    output.emails = (
      await Promise.all(ids.slice(0, 25).map((id) => gmail.getEmailMetadata(id).catch(() => null)))
    ).filter(Boolean);
    logs.push({ nodeId: node.id, status: 'success', message: `Read ${ids.length} emails` });
  } else if (actionType === 'gmail_label' || actionType === 'gmail_move') {
    const ids = await resolveMessageIds(gmail, params, output);
    if (ids.length === 0) {
      logs.push({ nodeId: node.id, status: 'skipped', message: 'No matching emails' });
      return;
    }
    const labelName = params.label || params.targetLabel || params.labelId;
    if (!labelName) throw new Error('A label/targetLabel is required');
    const labelId = await resolveLabelId(gmail, labelName);
    if (actionType === 'gmail_label') {
      await gmail.applyLabel(ids, labelId);
      logs.push({ nodeId: node.id, status: 'success', message: `Labeled ${ids.length} emails "${labelName}"` });
    } else {
      await gmail.moveEmails(ids, labelId);
      logs.push({ nodeId: node.id, status: 'success', message: `Moved ${ids.length} emails to "${labelName}"` });
    }
  } else if (actionType === 'gmail_send') {
    const to = interpolate(params.to || params.recipient, output);
    if (!to) throw new Error('Recipient (to) is required for gmail_send');
    const subject = interpolate(params.subject, output) || '(sans objet)';
    const body = interpolate(params.body, output) || '';

    if (safeMode) {
      // Stage a draft (for review in Gmail) AND queue for one-click approval
      const draft = await gmail.createDraft({ to, subject, body });
      output.draftId = draft.id;
      await stagePendingAction(userId, 'gmail_send', `Envoyer un email à ${to} — « ${subject} »`, { to, subject, body });
      logs.push({ nodeId: node.id, status: 'success', message: `Email à ${to} mis en attente (à valider)` });
    } else {
      const sent = await gmail.sendEmail({ to, subject, body });
      output.sentMessageId = sent.id;
      logs.push({ nodeId: node.id, status: 'success', message: `Email sent to ${to}` });
    }
  } else if (actionType === 'gmail_delete') {
    const ids = await resolveMessageIds(gmail, params, output);
    if (ids.length === 0) {
      logs.push({ nodeId: node.id, status: 'skipped', message: 'No matching emails' });
      return;
    }
    if (safeMode) {
      // Never delete — label "À supprimer" for visibility AND queue for approval
      const labelId = await resolveLabelId(gmail, 'À supprimer');
      await gmail.applyLabel(ids, labelId);
      await stagePendingAction(userId, 'gmail_delete', `Supprimer ${ids.length} email(s) (marqués « À supprimer »)`, { messageIds: ids, permanent: params.permanent === true });
      logs.push({ nodeId: node.id, status: 'success', message: `${ids.length} emails mis en attente de suppression (à valider)` });
    } else if (params.permanent === true) {
      await gmail.deleteEmailsPermanently(ids);
      logs.push({ nodeId: node.id, status: 'success', message: `Permanently deleted ${ids.length} emails` });
    } else {
      await gmail.deleteEmails(ids);
      logs.push({ nodeId: node.id, status: 'success', message: `Moved ${ids.length} emails to trash` });
    }
  } else if (actionType === 'gmail_classify') {
    const metas = await readEmailMetas(gmail, params);
    const classified = await classifyEmails(metas);
    output.classified = classified;
    logs.push({ nodeId: node.id, status: 'success', message: `Classified ${metas.length} emails` });
  } else if (actionType === 'calendar_create') {
    const emails: EmailMeta[] = output.emails || (await readEmailMetas(gmail, params));
    let created = 0;
    for (const email of emails) {
      const event = await extractCalendarEvent(email);
      if (event) {
        await prisma.calendarEvent.create({
          data: {
            userId,
            title: event.title,
            date: event.date,
            startTime: event.startTime || null,
            endTime: event.endTime || null,
            priority: 'medium',
          },
        });
        created++;
      }
    }
    output.eventsCreated = created;
    logs.push({ nodeId: node.id, status: 'success', message: `Created ${created} calendar event(s)` });
  } else if (actionType === 'track_application') {
    const emails: EmailMeta[] = output.emails || (await readEmailMetas(gmail, params));
    const created = await trackApplicationsFromEmails(userId, emails);
    output.applicationsTracked = created;
    logs.push({ nodeId: node.id, status: 'success', message: `Tracked ${created} application(s)` });
  } else {
    logs.push({ nodeId: node.id, status: 'skipped', message: `Unknown action: ${actionType}` });
  }
}

/**
 * Detect job-application confirmation emails and upsert tracking entries.
 * Shared by the workflow action and the Gmail push webhook.
 */
export async function trackApplicationsFromEmails(userId: string, emails: EmailMeta[]): Promise<number> {
  let created = 0;
  for (const email of emails) {
    const app = await detectJobApplication(email);
    if (!app) continue;

    // Avoid duplicates: same company already tracked recently from email
    const existing = await prisma.jobApplication.findFirst({
      where: { userId, company: app.company, source: 'email' },
    });
    if (existing) continue;

    await prisma.jobApplication.create({
      data: {
        userId,
        company: app.company,
        position: app.position || null,
        status: 'applied',
        source: 'email',
        sourceEmailId: email.id,
        notes: app.summary || null,
      },
    });
    created++;
  }
  return created;
}

async function readEmailMetas(gmail: GmailClient, params: Record<string, any>): Promise<EmailMeta[]> {
  const search = await gmail.searchEmails({
    q: params.query || 'is:unread',
    maxResults: Number(params.maxResults) || 20,
  });
  const ids = (search.messages || []).map((m) => m.id);
  return (
    await Promise.all(ids.map((id) => gmail.getEmailMetadata(id).catch(() => null)))
  ).filter(Boolean) as EmailMeta[];
}

async function resolveMessageIds(
  gmail: GmailClient,
  params: Record<string, any>,
  output: Record<string, any>
): Promise<string[]> {
  if (Array.isArray(params.messageIds) && params.messageIds.length > 0) return params.messageIds;
  if (Array.isArray(output.messageIds) && output.messageIds.length > 0) return output.messageIds;
  if (params.query) {
    const search = await gmail.searchEmails({
      q: params.query,
      maxResults: Number(params.maxResults) || 25,
    });
    return (search.messages || []).map((m) => m.id);
  }
  return [];
}

async function resolveLabelId(gmail: GmailClient, labelName: string): Promise<string> {
  if (labelName === labelName.toUpperCase() && !labelName.includes(' ')) return labelName;
  let label = await gmail.getLabelByName(labelName);
  if (!label) label = await gmail.createLabel(labelName);
  return label.id;
}

/** Evaluate a filter-style condition (field operator value) against the context. */
function evaluateCondition(field: string, operator: string, value: any, output: Record<string, any>): boolean {
  const fieldValue = output[field];
  if (fieldValue === undefined || fieldValue === null) return false;
  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'contains':
      return String(fieldValue).includes(value);
    case 'startsWith':
      return String(fieldValue).startsWith(value);
    case 'endsWith':
      return String(fieldValue).endsWith(value);
    default:
      return Boolean(fieldValue);
  }
}

/**
 * Evaluate an if_then condition string. Supports:
 *   "field op value"  (op in ==,!=,>,<,>=,<=,contains)  e.g. "emails.length > 0"
 *   "field"           (truthiness of output[field])
 */
function evaluateIfThen(condition: string | undefined, output: Record<string, any>): boolean {
  if (!condition || typeof condition !== 'string') return false;
  const tokens = condition.trim().split(/\s+/);

  const resolve = (token: string): any => {
    // dotted path support: a.b.length
    if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
    if (token === 'true') return true;
    if (token === 'false') return false;
    return token.split('.').reduce((acc: any, key) => (acc == null ? acc : acc[key]), output);
  };

  if (tokens.length === 1) {
    const v = resolve(tokens[0]);
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  }

  if (tokens.length >= 3) {
    const left = resolve(tokens[0]);
    const op = tokens[1];
    const right = resolve(tokens.slice(2).join(' '));
    switch (op) {
      case '==':
        return left == right;
      case '!=':
        return left != right;
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
      case 'contains':
        return String(left).includes(String(right));
      default:
        return false;
    }
  }

  return false;
}

async function finalize(
  executionId: string,
  status: 'success' | 'failed',
  output: Record<string, any>,
  logs: LogEntry[],
  error?: string
): Promise<WorkflowRunResult> {
  await prisma.workflowExecution.update({
    where: { id: executionId },
    data: {
      status,
      output: output as any,
      logs: logs as any,
      error: error || null,
      completedAt: new Date(),
    },
  });
  return { executionId, status, output, logs, error };
}
