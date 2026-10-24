/**
 * Email intelligence — Ollama-powered analysis of Gmail messages.
 *
 *  - classifyEmails()      : triage emails into actionable categories + brand
 *  - extractCalendarEvent(): detect a meeting/appointment in an email
 */

import { AiError, generateJSON } from '@/lib/ai/llm';
import { looksImportant, serviceFromSender } from './subscription-intelligence';

// Schémas des réponses JSON (stricts : tous les champs requis, aucun champ en plus). Un champ inconnu
// est une chaîne vide plutôt que null : avec Ollama, "string | null" (anyOf) rend la génération ~10x plus lente.
const NULLABLE_STRING = { type: 'string' };
const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    emails: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: { type: 'string', enum: ['to_process', 'to_keep', 'processed', 'promo', 'spam'] },
          brand: NULLABLE_STRING,
          reason: { type: 'string' },
        },
        required: ['id', 'category', 'brand', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['emails'],
  additionalProperties: false,
};
const EVENT_SCHEMA = {
  type: 'object',
  properties: {
    hasEvent: { type: 'boolean' },
    title: { type: 'string' },
    date: { type: 'string' },
    startTime: NULLABLE_STRING,
    endTime: NULLABLE_STRING,
  },
  required: ['hasEvent', 'title', 'date', 'startTime', 'endTime'],
  additionalProperties: false,
};
const APPLICATION_SCHEMA = {
  type: 'object',
  properties: {
    isApplication: { type: 'boolean' },
    company: { type: 'string' },
    position: NULLABLE_STRING,
    summary: NULLABLE_STRING,
  },
  required: ['isApplication', 'company', 'position', 'summary'],
  additionalProperties: false,
};

export interface EmailMeta {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date?: string;
  // Libellés Gmail (ex: CATEGORY_PROMOTIONS) et en-tête List-Unsubscribe : signaux marketing
  labelIds?: string[];
  hasListUnsubscribe?: boolean;
}

export type EmailCategory = 'to_process' | 'to_keep' | 'processed' | 'promo' | 'spam';

export interface ClassifiedEmail {
  id: string;
  category: EmailCategory;
  brand: string | null; // sender brand/company for promo grouping, e.g. "Showroomprive"
  reason: string;
}

const CLASSIFY_SYSTEM = [
  'You are an email triage assistant. You receive a list of emails (id, from, subject, snippet).',
  'For each email return an object: { "id", "category", "brand", "reason" }.',
  'category must be one of: "to_process" (needs action/reply), "to_keep" (important, archive),',
  '"processed" (already handled/notifications), "promo" (marketing/newsletters/promotions), "spam".',
  'brand: for promo emails, the company/brand name extracted from the sender (e.g. "Showroomprive", "Amazon"), else an empty string.',
  'Respond ONLY with a JSON object of the form { "emails": [ ... ] }. No prose.',
].join(' ');

/**
 * Classify a batch of emails into triage categories.
 * Returns one ClassifiedEmail per input; falls back to "to_process" on parse issues.
 */
export async function classifyEmails(emails: EmailMeta[]): Promise<ClassifiedEmail[]> {
  if (emails.length === 0) return [];

  const compact = emails.map((e) => ({
    id: e.id,
    from: e.from,
    subject: e.subject,
    snippet: (e.snippet || '').slice(0, 200),
  }));

  try {
    const result = await generateJSON<{ emails: ClassifiedEmail[] }>({
      system: CLASSIFY_SYSTEM,
      prompt: `Classify these emails:\n${JSON.stringify(compact)}`,
      schema: CLASSIFY_SCHEMA,
      purpose: 'email',
    });

    const byId = new Map((result.emails || []).map((c) => [c.id, c]));
    return emails.map((e) => {
      const c = byId.get(e.id);
      if (!c) return classifyLocally(e);
      return {
        id: e.id,
        category: (c.category as EmailCategory) || 'to_process',
        brand: c.brand || null,
        reason: c.reason || 'unclassified',
      };
    });
  } catch (error) {
    // IA indisponible ou désactivée pour les mails (confidentialité) : tri local, rien ne sort du serveur
    if (!(error instanceof AiError && error.code === 'not_configured')) console.error('classifyEmails failed:', error);
    return emails.map(classifyLocally);
  }
}

/**
 * Tri sans IA, à partir des catégories que Gmail calcule déjà (onglets Promotions, Réseaux sociaux,
 * Notifications, Forums), du lien de désabonnement des envois de masse et des mots importants.
 */
export function classifyLocally(email: EmailMeta): ClassifiedEmail {
  const labels = email.labelIds || [];
  if (labels.includes('SPAM')) return { id: email.id, category: 'spam', brand: null, reason: 'Classé spam par Gmail' };
  if (looksImportant(email)) return { id: email.id, category: 'to_process', brand: null, reason: 'Mots importants (règle locale)' };
  if (labels.includes('CATEGORY_PROMOTIONS') || (email.hasListUnsubscribe && !labels.includes('CATEGORY_PERSONAL'))) {
    return { id: email.id, category: 'promo', brand: serviceFromSender(email.from || ''), reason: 'Promotion (catégorie Gmail)' };
  }
  if (labels.some((l) => l === 'CATEGORY_SOCIAL' || l === 'CATEGORY_UPDATES' || l === 'CATEGORY_FORUMS')) {
    return { id: email.id, category: 'processed', brand: null, reason: 'Notification (catégorie Gmail)' };
  }
  return { id: email.id, category: 'to_process', brand: null, reason: 'Par défaut (règle locale)' };
}

export interface ExtractedEvent {
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
}

const EVENT_SYSTEM = [
  'You extract calendar appointments from a single email.',
  'If the email clearly contains a meeting/appointment/interview with a date, return',
  '{ "hasEvent": true, "title": "...", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM" }.',
  'If there is no concrete dated appointment, return { "hasEvent": false }.',
  'Use an empty string for unknown time fields. Respond ONLY with JSON.',
].join(' ');

/**
 * Extract a calendar event from an email, or null if none is present.
 */
export async function extractCalendarEvent(email: EmailMeta): Promise<ExtractedEvent | null> {
  try {
    const result = await generateJSON<{
      hasEvent: boolean;
      title?: string;
      date?: string;
      startTime?: string | null;
      endTime?: string | null;
    }>({
      system: EVENT_SYSTEM,
      prompt: `Email:\nFrom: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date || ''}\nBody: ${email.snippet}`,
      schema: EVENT_SCHEMA,
      purpose: 'email',
    });

    if (!result.hasEvent || !result.date || !result.title) return null;

    return {
      title: result.title,
      date: result.date,
      startTime: result.startTime || undefined,
      endTime: result.endTime || undefined,
    };
  } catch (error) {
    // Sans IA pour les mails (confidentialité), pas de détection fiable de rendez-vous : on n'en crée pas
    if (!(error instanceof AiError && error.code === 'not_configured')) console.error('extractCalendarEvent failed:', error);
    return null;
  }
}

export interface DetectedApplication {
  company: string;
  position: string | null;
  summary: string | null;
}

const APPLICATION_SYSTEM = [
  'You detect job / internship application CONFIRMATION emails.',
  'A confirmation email acknowledges that the user SENT an application (e.g. "we received your application",',
  '"votre candidature a bien été reçue", "merci pour votre candidature", "application submitted").',
  'If the email is such a confirmation, return',
  '{ "isApplication": true, "company": "...", "position": "..." or "" if unknown, "summary": "short note" }.',
  'If it is NOT an application confirmation (newsletter, promo, interview invite already scheduled, rejection, etc),',
  'return { "isApplication": false }. Respond ONLY with JSON.',
].join(' ');

/**
 * Detect whether an email confirms that the user submitted a job/internship application.
 * Returns the extracted company/position, or null if it is not a confirmation.
 */
export async function detectJobApplication(email: EmailMeta): Promise<DetectedApplication | null> {
  try {
    const result = await generateJSON<{
      isApplication: boolean;
      company?: string;
      position?: string | null;
      summary?: string | null;
    }>({
      system: APPLICATION_SYSTEM,
      prompt: `Email:\nFrom: ${email.from}\nSubject: ${email.subject}\nBody: ${email.snippet}`,
      schema: APPLICATION_SCHEMA,
      purpose: 'email',
    });

    if (!result.isApplication || !result.company) return null;

    return {
      company: result.company,
      position: result.position || null,
      summary: result.summary || null,
    };
  } catch (error) {
    // IA indisponible ou désactivée pour les mails (confidentialité) : détection par mots-clés, en local
    if (!(error instanceof AiError && error.code === 'not_configured')) console.error('detectJobApplication failed:', error);
    return detectJobApplicationLocally(email);
  }
}

// Confirmations de candidature (et non refus, relances ou offres d'emploi)
const APPLICATION_CONFIRMATION = [
  'candidature a bien été reçue', 'candidature a bien ete recue', 'avons bien reçu votre candidature',
  'avons bien recu votre candidature', 'merci pour votre candidature', 'merci de votre candidature',
  'confirmation de candidature', 'confirmation de votre candidature', 'votre candidature a été envoyée',
  'we received your application', 'we have received your application', 'thank you for applying',
  'thanks for applying', 'application received', 'application submitted', 'your application has been submitted',
];
const APPLICATION_EXCLUDE = [
  'malheureusement', 'unfortunately', 'pas retenue', 'not been selected', 'not moving forward',
  'offres d\'emploi', 'job alert', 'alerte emploi', 'newsletter',
];

/** Détection d'une confirmation de candidature par mots-clés ; l'entreprise est déduite de l'expéditeur. */
export function detectJobApplicationLocally(email: EmailMeta): DetectedApplication | null {
  const text = `${email.subject}\n${email.snippet}`.toLowerCase();
  if (!APPLICATION_CONFIRMATION.some((k) => text.includes(k))) return null;
  if (APPLICATION_EXCLUDE.some((k) => text.includes(k))) return null;
  const position = email.subject.match(/(?:poste|position|offre|role)\s*(?:de|d'|:|-|–)?\s*«?\s*([^»\n|]{3,80})/i)?.[1]?.trim() || null;
  return { company: serviceFromSender(email.from || ''), position, summary: 'Détectée par règle locale' };
}
