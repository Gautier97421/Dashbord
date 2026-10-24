/**
 * Subscription intelligence — detects subscription-related emails.
 *
 * HEURISTIC-FIRST: works fully without any LLM (robust keyword rules), which is
 * essential because Ollama may not be reachable from the server. Ollama, when
 * available, can refine the service name but is never required.
 */

import type { EmailMeta } from './email-intelligence';

export type SubscriptionAction =
  | 'new'
  | 'renewal'
  | 'payment'
  | 'cancellation'
  | 'trial_ending'
  | 'price_increase'
  | 'other';

export interface SubscriptionSignal {
  isSubscription: boolean;
  action: SubscriptionAction;
  service: string;       // best-guess service/brand name
  amount: string | null; // e.g. "9,99 €" if found
}

// Keyword groups (French + English), lowercase.
const KW = {
  cancellation: [
    'résiliation', 'resiliation', 'résilié', 'resilie', 'annulation', 'annulé', 'annule',
    'cancelled', 'canceled', 'cancellation', 'your subscription has been canceled',
    'abonnement annulé', 'abonnement résilié', 'sorry to see you go', 'unsubscribe confirmed',
    'désabonnement', 'desabonnement', 'membership cancelled', 'plan cancelled',
  ],
  price_increase: [
    'augmentation de prix', 'hausse de prix', 'nouveau tarif', 'nouveaux tarifs',
    'price increase', 'price change', 'updating our prices', 'changement de tarif',
    'évolution tarifaire', 'evolution tarifaire', 'price update', 'updated pricing',
  ],
  // Uniquement la fin d'un essai en cours : "essai gratuit" / "free trial" seuls sont surtout des pubs
  trial_ending: [
    'trial ends', 'trial ending', 'votre essai', 'fin de la période d\'essai', 'fin de la periode d\'essai',
    'trial expires', 'your free trial ends', 'your trial', 'essai se termine', 'essai prend fin',
  ],
  renewal: [
    'renouvellement', 'renouvelé', 'renouvele', 'renewal', 'auto-renew', 'auto renew',
    'reconduction', 'votre abonnement sera renouvelé', 'subscription renews', 'will renew',
    'renews on', 'prochaine échéance',
  ],
  payment: [
    'votre facture', 'facture', 'invoice', 'receipt', 'reçu de paiement', 'recu de paiement',
    'payment received', 'paiement reçu', 'paiement accepté', 'billing', 'your payment',
    'order confirmation', 'confirmation de paiement', 'montant prélevé', 'prelevement',
  ],
  newSub: [
    'bienvenue', 'welcome to', 'votre abonnement', 'subscription confirmed',
    'abonnement confirmé', 'merci de vous être abonné', 'thanks for subscribing',
    'your membership', 'votre adhésion', 'subscription activated',
  ],
  general: [
    'abonnement', 'subscription', 'membership', 'adhésion', 'plan ', 'forfait',
  ],
};

// Well-known subscription services for nicer naming.
const KNOWN_SERVICES: Record<string, string> = {
  netflix: 'Netflix', spotify: 'Spotify', 'amazon': 'Amazon', 'primevideo': 'Prime Video',
  'disney': 'Disney+', 'disneyplus': 'Disney+', 'youtube': 'YouTube', 'deezer': 'Deezer',
  'canalplus': 'Canal+', 'canal': 'Canal+', 'apple': 'Apple', 'icloud': 'iCloud',
  'microsoft': 'Microsoft', 'office365': 'Microsoft 365', 'adobe': 'Adobe', 'dropbox': 'Dropbox',
  'github': 'GitHub', 'notion': 'Notion', 'openai': 'OpenAI', 'anthropic': 'Anthropic',
  'linkedin': 'LinkedIn', 'audible': 'Audible', 'twitch': 'Twitch', 'patreon': 'Patreon',
  'molotov': 'Molotov', 'paramount': 'Paramount+', 'crunchyroll': 'Crunchyroll',
  'sfr': 'SFR', 'orange': 'Orange', 'free': 'Free', 'bouygues': 'Bouygues',
  'freetelecom': 'Freebox', 'free-mobile': 'Free Mobile',
  'salle de sport': 'Salle de sport', 'basicfit': 'Basic-Fit', 'fitnesspark': 'Fitness Park',
};

function haystack(email: EmailMeta): string {
  return `${email.subject || ''}\n${email.snippet || ''}\n${email.from || ''}`.toLowerCase();
}

function anyMatch(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

// Plateformes d'envoi ou de paiement utilisées par d'autres marques : leur domaine n'est pas le service
const SENDING_PLATFORMS = new Set([
  'gocardless', 'deciplus', 'stripe', 'paypal', 'mailchimp', 'mcsv', 'sendgrid', 'mailjet', 'sendinblue', 'brevo',
  'hubspot', 'zendesk', 'intercom', 'gmail', 'googlemail', 'outlook', 'hotmail', 'yahoo', 'mailgun', 'amazonses',
]);
const SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'gouv']);

const squash = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Marque du domaine : "mail-fr.nespresso.com" -> "nespresso", "x.co.uk" -> "x". */
function brandLabel(from: string): string {
  const host = from.match(/@([\w.-]+)/)?.[1]?.toLowerCase() || '';
  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) return labels[0] || '';
  let i = labels.length - 2;
  if (SECOND_LEVEL.has(labels[i]) && i > 0) i--;
  return labels[i];
}

/**
 * Nom du service d'après l'expéditeur. Le domaine identifie la marque (un mail signé
 * "Alexandre Bardyn <alexandre@escapad.city>" vient d'ESCAPAD) ; on l'écrit comme dans le
 * nom affiché quand il y figure ("Foot Locker", "ESCAPAD").
 */
export function serviceFromSender(from: string): string {
  const label = brandLabel(from);
  if (label && KNOWN_SERVICES[label]) return KNOWN_SERVICES[label];

  const display = from.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim() || '';
  if (label && !SENDING_PLATFORMS.has(label)) {
    // Suite de mots du nom affiché qui forme exactement la marque du domaine
    const words = display.split(/[\s|,–—:]+/).filter(Boolean);
    for (let start = 0; start < words.length; start++) {
      for (let end = start + 1; end <= words.length; end++) {
        const candidate = words.slice(start, end);
        if (squash(candidate.join('')) === squash(label)) return candidate.join(' ');
      }
    }
    // Marque connue citée dans le nom affiché (ex: "Netflix" envoyé depuis un autre domaine)
    const lowerDisplay = display.toLowerCase();
    for (const key of Object.keys(KNOWN_SERVICES)) {
      if (key.length > 3 && lowerDisplay.includes(key)) return KNOWN_SERVICES[key];
    }
    return label.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  if (display) return display;
  if (label) return label.charAt(0).toUpperCase() + label.slice(1);
  return 'Service inconnu';
}

/** Try to find a money amount in the text (€ or $). */
function extractAmount(text: string): string | null {
  const m = text.match(/(\d{1,4}([.,]\d{2})?)\s?(€|eur|euros?|\$|usd)/i)
    || text.match(/(€|\$)\s?(\d{1,4}([.,]\d{2})?)/);
  return m ? m[0].replace(/\s+/g, ' ').trim() : null;
}

/**
 * Heuristic subscription analysis — no network calls, always available.
 */
function isKnownService(from: string): boolean {
  return !!KNOWN_SERVICES[brandLabel(from || '')];
}

/**
 * @param assumeSubscription expéditeur déjà repéré comme un abonnement : ses factures et paiements
 *   comptent même si l'objet ne dit pas "abonnement" (ex: "Votre facture Nespresso")
 */
export function analyzeSubscription(email: EmailMeta, assumeSubscription = false): SubscriptionSignal {
  const text = haystack(email);
  const service = serviceFromSender(email.from || '');
  const amount = extractAmount(`${email.subject} ${email.snippet}`);
  const known = assumeSubscription || isKnownService(email.from || '');
  // For well-known subscription services we don't require the generic "abonnement" word.
  const ctx = known || anyMatch(text, KW.general);

  // Priority order: cancellation > price increase > trial ending > renewal > payment > new
  let action: SubscriptionAction | null = null;
  // Une annulation n'est une résiliation que s'il s'agit d'un abonnement (pas un billet ou une commande annulés)
  if (anyMatch(text, KW.cancellation) && anyMatch(text, KW.general)) action = 'cancellation';
  else if (anyMatch(text, KW.price_increase) && ctx) action = 'price_increase';
  else if (anyMatch(text, KW.trial_ending)) action = 'trial_ending';
  else if (anyMatch(text, KW.renewal) && ctx) action = 'renewal';
  else if (anyMatch(text, KW.payment) && ctx) action = 'payment';
  else if (anyMatch(text, KW.newSub) && ctx) action = 'new';
  else if (anyMatch(text, KW.general)) action = 'other';

  if (!action) {
    return { isSubscription: false, action: 'other', service, amount };
  }

  return { isSubscription: true, action, service, amount };
}

// ── Abonnement réellement payé vs publicité ─────────────────────────────────────

// Preuves d'une transaction : facture, paiement, renouvellement, confirmation…
const KW_TRANSACTION = [
  'facture', 'invoice', 'reçu', 'recu de', 'receipt', 'paiement reçu', 'paiement recu', 'payment received',
  'confirmation de paiement', 'payment confirmation', 'montant prélevé', 'montant preleve', 'prélèvement', 'prelevement',
  'a été débité', 'a ete debite', 'charged', 'numéro de facture', 'numero de facture', 'invoice number', 'n° de facture',
  'total ttc', 'net à payer', 'net a payer', 'tva', 'vat', 'moyen de paiement', 'payment method',
  'carte se terminant', 'card ending', 'a été renouvelé', 'a ete renouvele', 'has been renewed', 'renouvellement de votre',
  'abonnement confirmé', 'abonnement confirme', 'subscription confirmed', 'votre abonnement a été', 'votre abonnement a ete',
  'your subscription has been', 'résiliation confirmée', 'resiliation confirmee', 'confirmation de résiliation',
  'votre essai se termine', 'your trial ends', 'prochain prélèvement', 'prochain prelevement', 'next billing', 'next payment',
];

// Indices d'abonnement récurrent (et non d'un achat ponctuel)
const KW_RECURRING = [
  'abonnement', 'subscription', 'membership', 'adhésion', 'adhesion', 'forfait', 'renouvel', 'renew',
  'mensuel', 'annuel', 'par mois', '/mois', 'per month', '/month', 'monthly', 'yearly', 'annual',
  'prochain prélèvement', 'prochain prelevement', 'next billing', 'échéance', 'echeance', 'contrat',
];

// Vocabulaire marketing
const KW_PROMO = [
  'offre', 'promo', 'code promo', 'réduction', 'reduction', 'remise', 'soldes', 'profitez', 'découvrez', 'decouvrez',
  'essayez', 'jusqu\'à', 'jusqu\'a', 'dernière chance', 'derniere chance', 'last chance', 'black friday', 'cyber monday',
  'newsletter', 'exclusi', 'limited time', 'durée limitée', 'duree limitee', 'économisez', 'economisez', 'save up',
  'abonnez-vous', 'subscribe now', 'inscrivez-vous', 'sign up', 'rejoignez', 'join now', 'gratuit pendant', 'free for',
  'ne manquez pas', "don't miss", 'nouveauté', 'nouveaute', 'bon plan',
];
const PROMO_PERCENT = /-\s?\d{1,2}\s?%|\d{1,2}\s?% de réduction|\d{1,2}\s?% off/;

// Mots courts en mot entier ("vat" ne doit pas trouver "private"), les autres en sous-chaîne
const hasWord = (text: string, w: string) =>
  w.length <= 4 ? new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}($|[^\\p{L}])`, 'u').test(text) : text.includes(w);

const countMatches = (text: string, words: string[], cap: number) =>
  Math.min(cap, words.filter((w) => hasWord(text, w)).length);

// Achat ponctuel : commande, expédition, livraison
const KW_PURCHASE = [
  'votre commande', 'commande n', 'your order', 'order #', 'order number', 'expédié', 'expedie', 'shipped',
  'livraison', 'delivery', 'colis', 'suivi de commande', 'billet', 'e-billet', 'voyage', 'réservation', 'reservation',
];

export interface PaidSubscriptionCheck {
  ok: boolean;
  reason: 'paid' | 'promo' | 'no_transaction' | 'not_recurring';
  // Commande / livraison / billet : jamais un abonnement, même s'il y en a plusieurs
  purchase: boolean;
}

/**
 * Vérifie, sur le texte complet (mail + facture jointe), qu'il s'agit bien d'un abonnement
 * payé ou résilié par l'utilisateur, et pas d'une publicité ou d'un achat ponctuel.
 */
export function confirmPaidSubscription(email: EmailMeta, fullText: string): PaidSubscriptionCheck {
  const text = `${email.subject}\n${email.snippet}\n${fullText}`.toLowerCase();
  const transaction = countMatches(text, KW_TRANSACTION, 4);
  const promo =
    (email.labelIds?.includes('CATEGORY_PROMOTIONS') ? 3 : 0) +
    (email.hasListUnsubscribe ? 1 : 0) +
    countMatches(text, KW_PROMO, 3) +
    (PROMO_PERCENT.test(text) ? 1 : 0);

  const recurring = KW_RECURRING.some((w) => hasWord(text, w));
  const purchase = !recurring && KW_PURCHASE.some((w) => hasWord(text, w));

  if (transaction === 0) return { ok: false, reason: 'no_transaction', purchase };
  // Mail marketing qui parle de facture ou de paiement en passant : il faut des preuves nettes
  if (promo >= 3 && transaction < 2) return { ok: false, reason: 'promo', purchase };
  if (promo > transaction + 2) return { ok: false, reason: 'promo', purchase };
  // Facture sans mot "abonnement" (ex: "Votre facture EDF est disponible") : le scan la retient
  // si le même service facture plusieurs fois à intervalle régulier
  if (!recurring) return { ok: false, reason: 'not_recurring', purchase };
  return { ok: true, reason: 'paid', purchase };
}

/** Whether an email looks "important" (needs the user's attention) — heuristic. */
export function looksImportant(email: EmailMeta): boolean {
  const text = haystack(email);
  const importantKw = [
    'urgent', 'important', 'action requise', 'action required', 'verify', 'vérifier',
    'confirm', 'confirmez', 'security', 'sécurité', 'connexion suspecte', 'suspicious',
    'password', 'mot de passe', 'facture impayée', 'overdue', 'échéance', 'deadline',
    'entretien', 'interview', 'rendez-vous', 'rdv', 'meeting',
  ];
  return anyMatch(text, importantKw);
}
