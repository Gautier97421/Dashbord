/**
 * Autonomous AI agent.
 *
 * Runs by itself (cron / push / manual) and manages the inbox without the user
 * having to build a workflow:
 *   - sorts subscription emails into a Gmail "Abonnements" label
 *   - detects cancellations / price increases / trial endings and notifies
 *   - tracks job-application confirmations
 *   - notifies about important new emails
 *
 * Heuristic-first: fully functional even when Ollama is unreachable.
 */

import { prisma } from '@/lib/prisma';
import { getGmailClientForUser, GmailNotConnectedError } from '@/lib/gmail/get-client';
import type { GmailClient } from '@/lib/gmail/client';
import type { EmailMeta } from './email-intelligence';
import { detectJobApplication } from './email-intelligence';
import { analyzeSubscription, confirmPaidSubscription, looksImportant, serviceFromSender, type SubscriptionAction, type SubscriptionSignal } from './subscription-intelligence';
import { readInvoiceAttachments, readInvoiceImage } from '@/lib/invoice-attachments';
import { extractBillingDetails, billsRegularly, planSubscription, type BillingDetails } from '@/lib/subscription-billing';
import { createNotification } from '@/lib/notifications';
import { syncIntegrations } from '@/lib/integrations';
import { runWatchesForUser } from '@/lib/integrations/watcher';
import { postToDiscordWebhook } from '@/lib/integrations/discord';

export interface AgentRunResult {
  ok: boolean;
  scanned: number;
  sorted: number;
  notified: number;
  applications: number;
  subscriptions: number;
  error?: string;
}

// A user-defined rule: "if <field> <op> <value> then <action>"
export interface AgentRule {
  id: string;
  field: 'from' | 'subject' | 'body' | 'any';
  op: 'contains' | 'equals';
  value: string;
  action: 'important' | 'label' | 'ignore';
  label?: string; // when action === 'label'
}

interface RuleMatch {
  ignore: boolean;
  important: boolean;
  labels: string[];
}

function matchRules(email: EmailMeta, rules: AgentRule[]): RuleMatch {
  const result: RuleMatch = { ignore: false, important: false, labels: [] };
  const fields = {
    from: (email.from || '').toLowerCase(),
    subject: (email.subject || '').toLowerCase(),
    body: (email.snippet || '').toLowerCase(),
  };
  for (const rule of rules) {
    if (!rule.value) continue;
    const needle = rule.value.toLowerCase();
    const haystacks = rule.field === 'any' ? [fields.from, fields.subject, fields.body] : [fields[rule.field] || ''];
    const hit = haystacks.some((h) => (rule.op === 'equals' ? h === needle : h.includes(needle)));
    if (!hit) continue;
    if (rule.action === 'ignore') result.ignore = true;
    else if (rule.action === 'important') result.important = true;
    else if (rule.action === 'label' && rule.label) result.labels.push(rule.label);
  }
  return result;
}

const SUB_LABEL = 'Abonnements';
const CANCEL_LABEL = 'Abonnements/Résiliés';

const ACTION_LABELS: Record<SubscriptionAction, string> = {
  new: 'Nouvel abonnement',
  renewal: 'Renouvellement',
  payment: 'Paiement',
  cancellation: 'Résiliation',
  trial_ending: "Fin d'essai",
  price_increase: 'Hausse de prix',
  other: 'Abonnement',
};

export async function getOrCreateAgentConfig(userId: string) {
  const existing = await prisma.agentConfig.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.agentConfig.create({ data: { userId } });
}

/**
 * Run the autonomous agent for a single user.
 * `manual` = triggered by the user clicking "Run now" (ignores the enabled flag).
 */
export async function runAgentForUser(userId: string, opts: { manual?: boolean } = {}): Promise<AgentRunResult> {
  const config = await getOrCreateAgentConfig(userId);

  if (!opts.manual && !config.enabled) {
    return { ok: false, scanned: 0, sorted: 0, notified: 0, applications: 0, subscriptions: 0, error: 'Agent disabled' };
  }

  let gmail: GmailClient;
  try {
    gmail = await getGmailClientForUser(userId);
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return { ok: false, scanned: 0, sorted: 0, notified: 0, applications: 0, subscriptions: 0, error: 'Gmail non connecté' };
    }
    throw err;
  }

  // Scan recent emails (newer than 3 days, capped)
  const emails = await readRecentEmails(gmail, 'newer_than:3d', 40);

  let sorted = 0, notified = 0, applications = 0, subscriptions = 0;

  // Forward an important alert to Discord if the user enabled it
  const forward = async (text: string) => {
    if (config.forwardToDiscord && config.discordWebhookUrl) {
      await postToDiscordWebhook(config.discordWebhookUrl, text).catch(() => {});
    }
  };

  // Resolve Gmail label ids once (best-effort)
  let subLabelId: string | null = null;
  let cancelLabelId: string | null = null;
  if (config.sortSubscriptions) {
    subLabelId = await ensureLabel(gmail, SUB_LABEL).catch(() => null);
    cancelLabelId = await ensureLabel(gmail, CANCEL_LABEL).catch(() => null);
  }

  // User-defined custom rules (how THEY want to sort / flag mail)
  const rules: AgentRule[] = Array.isArray(config.rules) ? (config.rules as any) : [];
  const ruleLabelIds = new Map<string, string>();

  for (const email of emails) {
    // ── Custom user rules (highest priority) ──
    const matched = matchRules(email, rules);
    if (matched.ignore) {
      continue; // user asked to ignore these — no notifications, no processing
    }
    for (const labelName of matched.labels) {
      try {
        let lid = ruleLabelIds.get(labelName);
        if (!lid) { lid = await ensureLabel(gmail, labelName); ruleLabelIds.set(labelName, lid); }
        await gmail.applyLabel([email.id], lid);
        sorted++;
      } catch { /* ignore */ }
    }
    if (matched.important) {
      const created = await createNotification({
        userId, type: 'important',
        title: `Email important — ${shortSender(email.from)}`,
        body: email.subject,
        link: 'ai-agent',
        dedupeKey: `rule:${email.id}`,
        meta: { from: email.from },
      });
      if (created) { notified++; await forward(`⭐ Email important — ${shortSender(email.from)} : ${email.subject}`); }
    }

    // ── Subscriptions ──
    // Premier tri sur l'objet/l'expéditeur, puis confirmation sur le mail complet et sa facture :
    // une pub qui parle d'abonnement passe à la suite (candidatures, mails importants)
    const candidate = analyzeSubscription(email);
    const evidence = candidate.isSubscription ? await buildEvidence(gmail, email, candidate).catch(() => null) : null;
    if (evidence?.paid) {
      const sub = evidence.sub;
      // Sort: label the email
      if (config.sortSubscriptions && subLabelId) {
        try {
          await gmail.applyLabel([email.id], subLabelId);
          if (sub.action === 'cancellation' && cancelLabelId) {
            await gmail.applyLabel([email.id], cancelLabelId);
          }
          sorted++;
        } catch { /* ignore label errors */ }
      }

      // Track the subscription record (prix et date de prélèvement lus dans le mail ou la facture)
      try {
        await saveSubscription(userId, sub.service, [evidence]);
        subscriptions++;
      } catch { /* ignore */ }

      // Notify on meaningful events
      if (config.detectCancellations && ['cancellation', 'price_increase', 'trial_ending', 'new'].includes(sub.action)) {
        const created = await notifyForSubscription(userId, email, sub.service, sub.action, evidence.details.amount ?? sub.amount);
        if (created) {
          notified++;
          if (sub.action === 'cancellation' || sub.action === 'price_increase') {
            await forward(`🔔 ${sub.action === 'cancellation' ? 'Résiliation' : 'Hausse de prix'} — ${sub.service}`);
          }
        }
      }
      continue; // handled
    }

    // ── Job applications ──
    if (config.trackApplications) {
      const app = await detectJobApplication(email).catch(() => null);
      if (app) {
        const existing = await prisma.jobApplication.findFirst({ where: { userId, company: app.company, source: 'email' } });
        if (!existing) {
          await prisma.jobApplication.create({
            data: { userId, company: app.company, position: app.position || null, status: 'applied', source: 'email', sourceEmailId: email.id, notes: app.summary || null },
          });
          applications++;
          const created = await createNotification({
            userId, type: 'application',
            title: `Candidature suivie — ${app.company}`,
            body: app.position ? `Poste : ${app.position}` : 'Confirmation de candidature détectée.',
            link: 'applications',
            dedupeKey: `app:${email.id}`,
          });
          if (created) notified++;
        }
        continue;
      }
    }

    // ── Important new emails ──
    if (config.notifyImportant && looksImportant(email)) {
      const created = await createNotification({
        userId, type: 'important',
        title: `Email important — ${shortSender(email.from)}`,
        body: email.subject,
        link: 'ai-agent',
        dedupeKey: `imp:${email.id}`,
        meta: { from: email.from },
      });
      if (created) notified++;
    }
  }

  // Also pull events from connected integrations (GitHub, Trello) into notifications
  try {
    const integ = await syncIntegrations(userId);
    notified += integ.github + integ.trello;
  } catch (e) {
    console.error('syncIntegrations failed:', e);
  }

  // Check product watches (restock / price drops)
  try {
    notified += await runWatchesForUser(userId);
  } catch (e) {
    console.error('runWatchesForUser failed:', e);
  }

  await prisma.agentConfig.update({ where: { userId }, data: { lastRunAt: new Date() } });

  return { ok: true, scanned: emails.length, sorted, notified, applications, subscriptions };
}

export interface SubscriptionScanResult {
  ok: boolean;
  scanned: number;
  found: number;
  // Mails écartés car publicitaires, et abonnements détectés à tort qui ont été retirés
  ignoredPromos?: number;
  removed?: number;
  error?: string;
}

const SUBSCRIPTION_SCAN_QUERY =
  'newer_than:180d (abonnement OR subscription OR facture OR invoice OR receipt OR renouvellement OR membership OR paiement)';

/**
 * Scan à la demande, dédié aux abonnements ("Suivi des abonnements" > "Scanner mes emails").
 * Contrairement à runAgentForUser (fenêtre de 3 jours, pensée pour un passage régulier en
 * fond), celui-ci regarde 6 mois en arrière pour retrouver des abonnements déjà en place.
 */
export async function scanSubscriptionsForUser(userId: string): Promise<SubscriptionScanResult> {
  let gmail: GmailClient;
  try {
    gmail = await getGmailClientForUser(userId);
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return { ok: false, scanned: 0, found: 0, error: 'Gmail non connecté' };
    }
    throw err;
  }

  const emails = await readRecentEmails(gmail, SUBSCRIPTION_SCAN_QUERY, 500);
  const firstPass = emails.map((email) => ({ email, sub: analyzeSubscription(email) }));
  // Expéditeurs repérés comme abonnements : leurs autres factures comptent aussi, même sans le
  // mot "abonnement" dans l'objet (ex: "Votre facture Nespresso")
  const subscriptionServices = new Set(firstPass.filter(({ sub }) => sub.isSubscription).map(({ sub }) => sub.service.toLowerCase()));
  const candidates = firstPass
    .map(({ email, sub }) =>
      !sub.isSubscription && subscriptionServices.has(sub.service.toLowerCase())
        ? { email, sub: analyzeSubscription(email, true) }
        : { email, sub })
    .filter(({ sub }) => sub.isSubscription);

  // Mail complet + facture jointe : confirme le paiement et donne prix / date de prélèvement
  const evidences = await mapWithLimit(candidates, 6, ({ email, sub }) => buildEvidence(gmail, email, sub).catch(() => null));

  // Tous les mails payés d'un même service ensemble : le plus récent donne le statut, les
  // paiements successifs donnent la fréquence et la prochaine échéance
  // Regroupement sans tenir compte de la casse ("ESCAPAD" / "Escapad"), sous le nom le plus fréquent
  const nameCounts = new Map<string, Map<string, number>>();
  for (const { sub } of candidates) {
    const counts = nameCounts.get(sub.service.toLowerCase()) || new Map<string, number>();
    counts.set(sub.service, (counts.get(sub.service) || 0) + 1);
    nameCounts.set(sub.service.toLowerCase(), counts);
  }
  const displayName = (service: string) =>
    [...(nameCounts.get(service.toLowerCase()) || new Map([[service, 1]]))].sort((a, b) => b[1] - a[1])[0][0];

  const byService = new Map<string, SubscriptionEvidence[]>();
  const plainInvoices = new Map<string, SubscriptionEvidence[]>();
  let ignoredPromos = 0;
  evidences.forEach((evidence, i) => {
    const service = displayName(candidates[i].sub.service);
    if (!evidence) return; // mail illisible : ni preuve ni contre-preuve
    if (evidence.paid) {
      byService.set(service, [...(byService.get(service) || []), evidence]);
    } else if (evidence.rejection === 'not_recurring' && !evidence.purchase) {
      plainInvoices.set(service, [...(plainInvoices.get(service) || []), evidence]);
    } else if (evidence.rejection === 'promo') {
      ignoredPromos++;
    }
  });

  // Factures sans le mot "abonnement" : elles comptent pour un abonnement déjà confirmé, ou quand
  // le même service facture à intervalle régulier (ex: "Votre facture EDF est disponible")
  for (const [service, invoices] of plainInvoices) {
    if (byService.has(service) || billsRegularly(invoices.map((e) => e.date))) {
      byService.set(service, [...(byService.get(service) || []), ...invoices.map((e) => ({ ...e, paid: true }))]);
    }
  }

  let found = 0;
  for (const [service, evidence] of byService) {
    try {
      await saveSubscription(userId, service, evidence);
      found++;
    } catch { /* ignore */ }
  }

  // Abonnements créés à tort par un ancien scan (pub, billet annulé…) : le service apparaît dans les
  // mails analysés mais aucun ne prouve un paiement. On ne retire que ceux jamais modifiés à la main.
  const confirmed = new Set([...byService.keys()].map((s) => s.toLowerCase()));
  const seen = new Set([
    ...candidates.map((c) => c.sub.service.toLowerCase()),
    ...emails.map((e) => serviceFromSender(e.from || '').toLowerCase()),
  ]);
  const autoRecords = await prisma.subscription.findMany({
    where: {
      userId, lastEmailId: { not: null }, editedAt: null, notes: null, dismissedAt: null,
      // (un simple "NOT manual" exclurait aussi les valeurs nulles en SQL)
      OR: [{ amountSource: null }, { amountSource: { not: 'manual' } }],
    },
    select: { id: true, service: true, lastEmailId: true },
  });
  // Reconnu par son nom, ou par son mail s'il a été nommé autrement par un ancien scan ("Bitstack" / "Bitstack App")
  const scannedIds = new Set(emails.map((e) => e.id));
  const confirmedIds = new Set([...byService.values()].flat().map((e) => e.email.id));
  const toRemove = autoRecords.filter((r) =>
    !confirmed.has(r.service.toLowerCase()) &&
    (seen.has(r.service.toLowerCase()) || (!!r.lastEmailId && scannedIds.has(r.lastEmailId) && !confirmedIds.has(r.lastEmailId))));
  const removed = toRemove.length
    ? (await prisma.subscription.deleteMany({ where: { id: { in: toRemove.map((r) => r.id) } } })).count
    : 0;

  return { ok: true, scanned: emails.length, found, ignoredPromos, removed };
}

interface SubscriptionEvidence {
  email: EmailMeta;
  sub: SubscriptionSignal;
  details: BillingDetails;
  date: Date | null;
  // false : publicité, achat ponctuel ou aucune preuve de paiement
  paid: boolean;
  rejection?: string;
  // Commande, livraison, billet : jamais un abonnement
  purchase: boolean;
}

/**
 * Lit le mail complet et ses factures jointes (PDF, HTML, image de facture en dernier recours),
 * vérifie que c'est un abonnement réellement payé et en extrait prix, fréquence et échéance.
 */
async function buildEvidence(gmail: GmailClient, email: EmailMeta, sub: SubscriptionSignal): Promise<SubscriptionEvidence> {
  const date = email.date ? new Date(email.date) : null;
  const validDate = date && !isNaN(date.getTime()) ? date : null;
  const content = await gmail.getEmailContent(email.id).catch(() => ({ text: '', attachments: [] }));
  const invoices = content.attachments.length
    ? await readInvoiceAttachments(gmail, email.id, content.attachments)
    : { text: '', images: [] };

  let fullText = `${content.text}\n${invoices.text}`;
  const check = confirmPaidSubscription(email, fullText);
  let details = extractBillingDetails(`${email.subject}\n${email.snippet}\n${fullText}`, validDate);

  // Facture en image uniquement : lue par le modèle de vision, seulement si c'est utile
  if (check.ok && !details.amount && invoices.images.length) {
    const fromImage = await readInvoiceImage(invoices.images[0]);
    if (fromImage) {
      fullText += `\n${fromImage}`;
      details = extractBillingDetails(`${email.subject}\n${email.snippet}\n${fullText}`, validDate);
    }
  }

  return {
    email, sub, details, date: validDate,
    paid: check.ok, rejection: check.ok ? undefined : check.reason, purchase: check.purchase,
  };
}

/**
 * Enregistre un abonnement à partir de ses mails (voir planSubscription) : le dernier événement de
 * facturation fixe le statut, la dernière facture le prix, sauf s'il a été saisi à la main.
 * Fréquence et échéance ne remplissent que les champs vides ; une échéance passée est remplacée.
 */
async function saveSubscription(userId: string, service: string, evidence: SubscriptionEvidence[]) {
  const now = new Date();
  let existing = await prisma.subscription.findFirst({
    where: { userId, service: { equals: service, mode: 'insensitive' } },
  });
  if (!existing) {
    // Abonnement déjà suivi sous un ancien nom (ex: "Free" avant la séparation Freebox / Free Mobile) :
    // retrouvé par ses mails, et renommé s'il n'a jamais été modifié à la main
    const emailIds = evidence.map((e) => e.email.id);
    const previous = await prisma.subscription.findFirst({
      where: { userId, OR: [{ lastEmailId: { in: emailIds } }, { invoiceEmailId: { in: emailIds } }] },
    });
    if (previous) {
      existing = previous.editedAt ? previous : await prisma.subscription.update({ where: { id: previous.id }, data: { service } });
    }
  }
  // Supprimé par l'utilisateur : on ne le recrée pas
  if (existing?.dismissedAt) return;
  const plan = planSubscription(
    evidence.map((e) => ({
      emailId: e.email.id, action: e.sub.action, date: e.date, details: e.details, fallbackAmount: e.sub.amount,
    })),
    {
      frequency: existing?.frequency && existing.frequency !== 'other' ? existing.frequency : null,
      nextBillingDate: existing?.nextBillingDate ?? null,
    },
    now
  );

  if (!existing) {
    await prisma.subscription.create({
      data: {
        userId, service, status: (plan.status ?? 'active') as any, lastAction: plan.lastAction, lastEmailId: plan.lastEmailId,
        amount: plan.amount, amountSource: plan.amount ? 'email' : null, invoiceEmailId: plan.invoiceEmailId,
        frequency: (plan.frequency as any) ?? null, nextBillingDate: plan.nextBillingDate,
      },
    });
    return;
  }

  // Le prix suit la dernière facture (ex: hausse de tarif) sauf s'il a été saisi à la main.
  // Avant le suivi de la source, un prix sur un abonnement détecté et jamais modifié venait d'un mail.
  const amountFromEmail = existing.amountSource === 'email'
    || (!existing.amountSource && !!existing.lastEmailId && !existing.editedAt);
  const updateAmount = !!plan.amount && plan.amount !== existing.amount && (!existing.amount || amountFromEmail);

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      // Sans événement de facturation (simple mail d'info), le statut et son mail ne changent pas
      ...(plan.status ? { status: plan.status as any, lastAction: plan.lastAction, lastEmailId: plan.lastEmailId } : {}),
      ...(updateAmount ? { amount: plan.amount, amountSource: 'email' } : {}),
      ...(plan.invoiceEmailId && (updateAmount || plan.amount === existing.amount) ? { invoiceEmailId: plan.invoiceEmailId } : {}),
      ...(!existing.frequency && plan.frequency ? { frequency: plan.frequency as any } : {}),
      ...(plan.status === 'cancelled'
        ? { nextBillingDate: null }
        : plan.nextBillingDate && (!existing.nextBillingDate || existing.nextBillingDate < now)
          ? { nextBillingDate: plan.nextBillingDate }
          : {}),
    },
  });
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function notifyForSubscription(
  userId: string, email: EmailMeta, service: string, action: SubscriptionAction, amount: string | null
): Promise<boolean> {
  const titles: Record<string, string> = {
    cancellation: `Résiliation confirmée — ${service}`,
    price_increase: `Hausse de prix — ${service}`,
    trial_ending: `Fin d'essai bientôt — ${service}`,
    new: `Nouvel abonnement — ${service}`,
  };
  const typeMap: Record<string, 'cancellation' | 'price_increase' | 'trial_ending' | 'subscription'> = {
    cancellation: 'cancellation', price_increase: 'price_increase', trial_ending: 'trial_ending', new: 'subscription',
  };
  return createNotification({
    userId,
    type: typeMap[action] || 'subscription',
    title: titles[action] || `${ACTION_LABELS[action]} — ${service}`,
    body: amount ? `${email.subject} (${amount})` : email.subject,
    link: 'ai-agent',
    dedupeKey: `sub:${email.id}:${action}`,
    meta: { service, amount },
  });
}

async function readRecentEmails(gmail: GmailClient, query: string, max: number): Promise<EmailMeta[]> {
  // Gmail renvoie au plus 500 résultats par page : on suit les pages jusqu'à "max"
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const search = await gmail.searchEmails({ q: query, maxResults: Math.min(500, max - ids.length), pageToken });
    ids.push(...(search.messages || []).map((m) => m.id));
    pageToken = search.nextPageToken;
  } while (pageToken && ids.length < max);
  // Requêtes en parallèle limitées, pour rester sous les quotas de l'API Gmail
  const metas = await mapWithLimit(ids, 10, (id) => gmail.getEmailMetadata(id).catch(() => null));
  return metas.filter(Boolean) as EmailMeta[];
}

async function ensureLabel(gmail: GmailClient, name: string): Promise<string> {
  const existing = await gmail.getLabelByName(name);
  if (existing) return existing.id;
  const created = await gmail.createLabel(name);
  return created.id;
}

function shortSender(from: string): string {
  const nameMatch = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (nameMatch && nameMatch[1].trim()) return nameMatch[1].trim();
  const emailMatch = from.match(/([\w.+-]+)@/);
  return emailMatch ? emailMatch[1] : from;
}
