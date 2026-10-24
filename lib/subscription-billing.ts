// Facturation des abonnements : extraction du prix, de la fréquence et de la date de prélèvement
// dans le texte d'un mail, et calculs de dates (prochain prélèvement, fréquence déduite).
// Sans dépendance : utilisé côté serveur (scan des mails) et côté client (tableau).

export type BillingFrequency = "weekly" | "monthly" | "yearly"

export interface BillingDetails {
  amount: string | null
  frequency: BillingFrequency | null
  nextBillingDate: Date | null
}

const DAY_MS = 24 * 60 * 60 * 1000

// Minuscules sans accents, même longueur que le texte d'origine
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC")

// ── Montant ─────────────────────────────────────────────────────────────────────

const AMOUNT_RE = /(€|\$|£|\beur\b|\busd\b)\s?(\d{1,4}(?:[.,]\d{1,2})?)|(\d{1,4}(?:[.,]\d{1,2})?)\s?(€|\$|£|\beur\b|\beuros?\b|\busd\b)/g
// Montant réellement payé, par ordre de priorité (une facture affiche aussi le total HT et la TVA)
const PAID_AMOUNT_KEYWORDS = [
  "net a payer", "total ttc", "montant ttc", "total a payer", "montant total", "montant preleve", "montant debite",
  "amount due", "total due", "amount paid", "total paid", "amount charged", "grand total",
]
// Mots proches du montant payé (plutôt qu'une promo ou un autre prix du mail)
const AMOUNT_KEYWORDS = ["total", "montant", "prix", "price", "amount", "charged", "preleve", "debite", "paye", "paid", "tarif", "facture", "invoice"]

// Les abonnements sont toujours payés en euros : prix enregistré au format "9,99 €"
export function formatEuroAmount(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`
}

/** Prix saisi ou reçu par l'API ("9.99", "9,99 €", 9.99) -> "9,99 €", ou null. */
export function normalizeEuroAmount(input: unknown): string | null {
  const value = typeof input === "number" ? input : parseAmount(typeof input === "string" ? input : null)
  return value != null && Number.isFinite(value) && value > 0 ? formatEuroAmount(value) : null
}

const isEuro = (currency: string) => currency === "€" || currency.startsWith("eur")

function extractAmount(text: string): string | null {
  const matches = [...text.matchAll(AMOUNT_RE)]
    .map((m) => {
      const raw = m[2] ?? m[3]
      const currency = (m[1] ?? m[4]).trim()
      return { index: m.index ?? 0, value: parseFloat(raw.replace(",", ".")), currency }
    })
    // Un montant en dollars ou en livres n'est pas le prélèvement en euros : on l'ignore
    .filter((m) => m.value > 0 && isEuro(m.currency))
  if (matches.length === 0) return null
  const amountAfter = (keyword: string) => {
    const positions = [...text.matchAll(new RegExp(keyword, "g"))].map((m) => m.index ?? 0)
    return matches.find((m) => positions.some((k) => m.index >= k && m.index - k <= 60))
  }
  for (const keyword of PAID_AMOUNT_KEYWORDS) {
    const paid = amountAfter(keyword)
    if (paid) return formatEuroAmount(paid.value)
  }
  const keywordPositions = AMOUNT_KEYWORDS.flatMap((k) => [...text.matchAll(new RegExp(k, "g"))].map((m) => m.index ?? 0))
  // Premier montant situé juste après un mot-clé ("Total : 13,49 €"), sinon le premier du mail
  const near = matches.find((m) => keywordPositions.some((k) => m.index >= k && m.index - k <= 60))
  const best = near ?? matches[0]
  return formatEuroAmount(best.value)
}

// ── Fréquence ───────────────────────────────────────────────────────────────────

const FREQUENCY_PATTERNS: [BillingFrequency, RegExp][] = [
  ["monthly", /par mois|\/\s?mois|mensuel|tous les mois|chaque mois|per month|\/\s?month|\/\s?mo\b|a month|monthly|each month/],
  ["yearly", /par an\b|\/\s?an\b|annuel|par annee|tous les ans|chaque annee|per year|\/\s?year|\/\s?yr\b|a year|yearly|annual/],
  ["weekly", /par semaine|hebdomadaire|\/\s?semaine|per week|\/\s?week|weekly/],
]

function extractFrequency(text: string): BillingFrequency | null {
  let best: { freq: BillingFrequency; index: number } | null = null
  for (const [freq, re] of FREQUENCY_PATTERNS) {
    const m = re.exec(text)
    if (m && (!best || m.index < best.index)) best = { freq, index: m.index }
  }
  return best?.freq ?? null
}

// ── Dates ───────────────────────────────────────────────────────────────────────

const MONTH_WORD =
  "janv(?:ier)?|fevr(?:ier)?|fev|mars|avr(?:il)?|mai|juin|juil(?:let)?|aout|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|dec(?:embre)?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|october|november|december"

function monthIndex(word: string): number {
  const w = word.toLowerCase()
  if (w.startsWith("juil") || w.startsWith("jul")) return 6
  if (w.startsWith("juin") || w.startsWith("jun")) return 5
  const prefixes: [string, number][] = [
    ["jan", 0], ["fev", 1], ["feb", 1], ["mar", 2], ["avr", 3], ["apr", 3], ["mai", 4], ["may", 4],
    ["aou", 7], ["aug", 7], ["sep", 8], ["oct", 9], ["nov", 10], ["dec", 11],
  ]
  return prefixes.find(([p]) => w.startsWith(p))?.[1] ?? -1
}

function makeDate(year: number, month: number, day: number): Date | null {
  if (year < 100) year += 2000
  if (month < 0 || month > 11 || day < 1 || day > 31 || year < 2000 || year > 2100) return null
  const d = new Date(Date.UTC(year, month, day, 12))
  return d.getUTCMonth() === month ? d : null
}

const DATE_PATTERNS: ((m: RegExpExecArray) => Date | null)[] = []
const DATE_RES: RegExp[] = [
  // 12 novembre 2026 / 1er mars 2027 / 12 nov. 2026
  new RegExp(`(\\d{1,2})(?:er)?\\s+(${MONTH_WORD})\\.?\\s+(\\d{4})`),
  // November 12, 2026 / Nov 12 2026
  new RegExp(`(${MONTH_WORD})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`),
  // 2026-11-12
  /(\d{4})-(\d{2})-(\d{2})/,
  // 12/11/2026 ou 12.11.26 (format français jour/mois/année)
  /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/,
]
DATE_PATTERNS.push(
  (m) => makeDate(+m[3], monthIndex(m[2]), +m[1]),
  (m) => makeDate(+m[3], monthIndex(m[1]), +m[2]),
  (m) => makeDate(+m[1], +m[2] - 1, +m[3]),
  (m) => makeDate(+m[3], +m[2] - 1, +m[1]),
)

// Première date trouvée dans un extrait de texte
function findDate(text: string): Date | null {
  let best: { date: Date; index: number } | null = null
  DATE_RES.forEach((re, i) => {
    const m = re.exec(text)
    if (!m) return
    const date = DATE_PATTERNS[i](m)
    if (date && (!best || m.index < best.index)) best = { date, index: m.index }
  })
  return best ? (best as { date: Date }).date : null
}

// Expressions qui annoncent la date du prochain prélèvement (ou de fin d'essai)
const NEXT_DATE_KEYWORDS = [
  "prochain prelevement", "prochaine echeance", "prochain paiement", "prochaine facture", "prochaine facturation",
  "prochaine date", "date de facturation", "date du prochain", "date de paiement",
  // "prélevé le" / "débité le" (au passé) désignent le paiement déjà fait : seules les formes au futur comptent
  "renouvel", "sera preleve", "sera debite", "date de prelevement", "date d'echeance",
  "fin de votre essai", "fin de la periode d'essai", "expire le", "valable jusqu",
  "next billing", "next payment", "next charge", "renews on", "renewal date", "will renew", "will be charged",
  "will be billed", "billing date", "trial ends", "expires on",
]

function extractNextDate(text: string, emailDate: Date | null): Date | null {
  const candidates: Date[] = []
  for (const keyword of NEXT_DATE_KEYWORDS) {
    let from = 0
    let idx: number
    while ((idx = text.indexOf(keyword, from)) !== -1) {
      const date = findDate(text.slice(idx, idx + keyword.length + 80))
      if (date) candidates.push(date)
      from = idx + keyword.length
    }
  }
  // L'échéance annoncée tombe après le jour du mail (le jour même = le paiement qu'il confirme) ; on garde la plus proche
  const emailDay = emailDate?.toISOString().slice(0, 10)
  const after = emailDay ? candidates.filter((d) => d.toISOString().slice(0, 10) > emailDay) : candidates
  after.sort((a, b) => a.getTime() - b.getTime())
  return after[0] ?? null
}

/** Prix, fréquence et prochaine date de prélèvement trouvés dans le texte d'un mail. */
export function extractBillingDetails(text: string, emailDate?: string | Date | null): BillingDetails {
  const t = normalize(text)
  const date = emailDate ? new Date(emailDate) : null
  return {
    amount: extractAmount(t),
    frequency: extractFrequency(t),
    nextBillingDate: extractNextDate(t, date && !isNaN(date.getTime()) ? date : null),
  }
}

// ── Calculs ─────────────────────────────────────────────────────────────────────

export function addPeriod(date: Date, frequency: BillingFrequency): Date {
  const d = new Date(date)
  if (frequency === "weekly") return new Date(d.getTime() + 7 * DAY_MS)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + (frequency === "monthly" ? 1 : 12))
  // 31 janvier + 1 mois = 28/29 février, pas 3 mars
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return d
}

/** Avance une date de prélèvement passée jusqu'à la prochaine échéance à venir. */
export function rollForward(date: Date, frequency: BillingFrequency | null | undefined, now = new Date()): Date {
  if (!frequency) return date
  let d = new Date(date)
  for (let i = 0; i < 600 && d.getTime() < now.getTime() - DAY_MS / 2; i++) d = addPeriod(d, frequency)
  return d
}

/** Fréquence déduite de l'intervalle entre plusieurs paiements (médiane). */
export function inferFrequency(paymentDates: Date[]): BillingFrequency | null {
  const sorted = [...paymentDates].sort((a, b) => a.getTime() - b.getTime())
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const days = (sorted[i].getTime() - sorted[i - 1].getTime()) / DAY_MS
    if (days >= 3) gaps.push(days) // deux mails pour le même paiement ne comptent pas
  }
  if (gaps.length === 0) return null
  gaps.sort((a, b) => a - b)
  const median = gaps[Math.floor(gaps.length / 2)]
  if (median >= 5 && median <= 9) return "weekly"
  // Large pour les prélèvements "tous les mois" décalés (week-ends, cycles de 5 semaines)
  if (median >= 25 && median <= 38) return "monthly"
  if (median >= 340 && median <= 390) return "yearly"
  return null
}

/** Plusieurs factures d'un même service espacées d'au moins 20 jours : facturation récurrente. */
export function billsRegularly(dates: (Date | null)[]): boolean {
  const times = dates.filter((d): d is Date => !!d).map((d) => d.getTime())
  return times.length >= 2 && Math.max(...times) - Math.min(...times) >= 20 * DAY_MS
}

// ── Synthèse d'un abonnement à partir de ses mails ──────────────────────────────

export interface PlannerEvidence {
  emailId: string
  // new | renewal | payment | cancellation | trial_ending | price_increase | other
  action: string
  date: Date | null
  details: BillingDetails
  // Montant trouvé dans l'objet du mail, à défaut du corps ou de la facture
  fallbackAmount?: string | null
}

export interface SubscriptionPlan {
  // null : aucun événement de facturation, le statut enregistré ne change pas
  status: "active" | "trial" | "cancelled" | null
  lastAction: string
  // Mail qui justifie le statut (dernier paiement, résiliation…) et mail d'où vient le prix
  lastEmailId: string
  invoiceEmailId: string | null
  amount: string | null
  frequency: BillingFrequency | null
  nextBillingDate: Date | null
}

// Seuls ces événements changent le statut : un mail d'information ("votre crédit est disponible")
// reçu après une résiliation ne doit pas réactiver l'abonnement
const STATUS_ACTIONS = ["payment", "renewal", "new", "cancellation", "trial_ending"]
const PAYMENT_ACTIONS = ["payment", "renewal", "new"]

export function planSubscription(
  evidence: PlannerEvidence[],
  existing: { frequency?: BillingFrequency | null; nextBillingDate?: Date | null } = {},
  now = new Date()
): SubscriptionPlan {
  const sorted = [...evidence].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
  const statusEvent = sorted.find((e) => STATUS_ACTIONS.includes(e.action))
  const status = !statusEvent ? null
    : statusEvent.action === "cancellation" ? "cancelled"
    : statusEvent.action === "trial_ending" ? "trial"
    : "active"
  const reference = statusEvent ?? sorted[0]

  // Le prix d'un abonnement est le montant qui revient (ex: crédit Nespresso de 19 € chaque mois,
  // alors que les factures de commandes de café varient) : le plus récent des montants vus au
  // moins deux fois, sinon le dernier paiement, sinon le dernier montant cité
  const amountCounts = new Map<string, number>()
  for (const e of sorted) if (e.details.amount) amountCounts.set(e.details.amount, (amountCounts.get(e.details.amount) || 0) + 1)
  const invoice =
    sorted.find((e) => e.details.amount && amountCounts.get(e.details.amount)! >= 2) ??
    sorted.find((e) => PAYMENT_ACTIONS.includes(e.action) && e.details.amount) ??
    sorted.find((e) => e.details.amount)
  const amount = invoice?.details.amount ?? sorted.find((e) => e.fallbackAmount)?.fallbackAmount ?? null
  const paymentDates = sorted.filter((e) => PAYMENT_ACTIONS.includes(e.action) && e.date).map((e) => e.date!)
  const recurringDates = invoice?.details.amount
    ? sorted.filter((e) => e.details.amount === invoice.details.amount && e.date).map((e) => e.date!)
    : []
  const foundFrequency =
    sorted.find((e) => e.details.frequency)?.details.frequency ?? inferFrequency(recurringDates) ?? inferFrequency(paymentDates)
  const frequency = existing.frequency ?? foundFrequency

  // Date annoncée dans un mail, sinon dernier paiement + une période ; avancée jusqu'à la prochaine à venir
  let next = sorted.find((e) => e.details.nextBillingDate)?.details.nextBillingDate ?? null
  if (!next && frequency && paymentDates.length) next = addPeriod(paymentDates[0], frequency)
  if (!next && existing.nextBillingDate && frequency) next = existing.nextBillingDate
  if (next) next = rollForward(next, frequency, now)
  if (status === "cancelled") next = null

  return {
    status,
    lastAction: reference.action,
    lastEmailId: reference.emailId,
    invoiceEmailId: invoice?.emailId ?? null,
    amount,
    frequency: foundFrequency,
    nextBillingDate: next,
  }
}

/** Montant numérique d'un texte libre comme "9,99 €". */
export function parseAmount(amount: string | null | undefined): number | null {
  if (!amount) return null
  const m = amount.match(/(\d+([.,]\d+)?)/)
  if (!m) return null
  const value = parseFloat(m[1].replace(",", "."))
  return isNaN(value) ? null : value
}

/** Coût ramené au mois, ou null si le montant ou la fréquence manque. */
export function monthlyCost(amount: string | null | undefined, frequency: string | null | undefined): number | null {
  const value = parseAmount(amount)
  if (value == null) return null
  if (frequency === "monthly") return value
  if (frequency === "yearly") return value / 12
  if (frequency === "weekly") return (value * 52) / 12
  return null
}
