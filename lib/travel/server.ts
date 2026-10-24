// Voyages côté serveur : validation des champs, mise en forme et alertes (cloche + push).

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getAlertPrefs } from "@/lib/projects/alert-prefs"
import { dayKey, hourIn } from "@/lib/projects/core"
import { sendPushToUser } from "@/lib/push"
import { displayName } from "@/lib/social"
import {
  ACTIVITY_KINDS,
  BOOKING_STATUSES,
  BOOKING_TYPES,
  CHECKLIST_CATEGORIES,
  CONTACT_KINDS,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  PLACE_KINDS,
  PLACE_STATUSES,
  addDays,
  daysBetween,
  formatDateTime,
  tripDeadlines,
  type Collection,
  type Trip,
  type TripContact,
  type TripStop,
  type Traveler,
} from "@/lib/travel/shared"

// ─── Validation ──────────────────────────────────────────────────────────────

type Field =
  | { type: "text"; max: number; required?: boolean }
  | { type: "long"; max?: number; required?: boolean }
  | { type: "day"; required?: boolean }
  | { type: "time" }
  | { type: "datetime" }
  | { type: "int"; min: number; max: number; notNull?: boolean }
  | { type: "money"; required?: boolean; positive?: boolean; zero?: boolean }
  | { type: "rate" }
  | { type: "bool" }
  | { type: "enum"; values: string[]; required?: boolean }
  | { type: "url" }
  | { type: "coord"; max: number }
  | { type: "ids" }
  | { type: "ref" }
  | { type: "currency" }

export type Spec = Record<string, Field>
const values = (options: { value: string }[]) => options.map((o) => o.value)

const DAY = /^\d{4}-\d{2}-\d{2}$/
const isDay = (v: unknown): v is string => typeof v === "string" && DAY.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime())

class FieldError extends Error {}

function parseField(name: string, field: Field, raw: unknown): unknown {
  const empty = raw === null || raw === undefined || raw === ""
  const fail = (message: string): never => {
    throw new FieldError(message)
  }
  if ("required" in field && field.required && empty) fail(`Champ requis : ${name}`)
  switch (field.type) {
    case "text":
    case "long": {
      if (empty) return null
      if (typeof raw !== "string") fail(`Texte invalide : ${name}`)
      const text = (raw as string).trim().slice(0, field.type === "text" ? field.max : field.max ?? 20_000)
      if (!text && "required" in field && field.required) fail(`Champ requis : ${name}`)
      return text || null
    }
    case "day":
      if (empty) return null
      return isDay(raw) ? raw : fail(`Date invalide : ${name}`)
    case "time":
      if (empty) return null
      return typeof raw === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : fail(`Heure invalide : ${name}`)
    case "datetime":
      if (empty) return null
      return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(raw) && isDay(raw.slice(0, 10)) ? raw : fail(`Date et heure invalides : ${name}`)
    case "int": {
      if (empty) return null
      const n = typeof raw === "number" ? raw : parseInt(String(raw), 10)
      return Number.isInteger(n) && n >= field.min && n <= field.max ? n : fail(`Nombre invalide : ${name}`)
    }
    case "money": {
      if (empty) return null
      const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/\s/g, "").replace(",", "."))
      if (!Number.isFinite(n) || n < 0 || n > 100_000_000 || (field.positive && n === 0)) fail(`Montant invalide : ${name}`)
      return Math.round(n * 100) / 100
    }
    case "rate": {
      if (empty) return 1
      const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."))
      return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : fail(`Taux invalide : ${name}`)
    }
    case "bool":
      return raw === true || raw === "true"
    case "enum":
      if (empty) return null
      return typeof raw === "string" && field.values.includes(raw) ? raw : fail(`Valeur invalide : ${name}`)
    case "url": {
      if (empty) return null
      try {
        const url = new URL(String(raw).trim())
        if ((url.protocol === "http:" || url.protocol === "https:") && url.href.length <= 2000) return url.href
      } catch {
        // invalide
      }
      return fail(`Lien invalide : ${name}`)
    }
    case "coord": {
      if (empty) return null
      const n = typeof raw === "number" ? raw : parseFloat(String(raw))
      return Number.isFinite(n) && Math.abs(n) <= field.max ? n : fail(`Coordonnée invalide : ${name}`)
    }
    case "ids":
      if (empty) return []
      if (!Array.isArray(raw)) fail(`Liste invalide : ${name}`)
      return (raw as unknown[]).filter((v): v is string => typeof v === "string" && v.length <= 60).slice(0, 50)
    case "ref":
      if (empty) return null
      return typeof raw === "string" && raw.length <= 60 ? raw : fail(`Référence invalide : ${name}`)
    case "currency":
      if (empty) return null
      return typeof raw === "string" && CURRENCIES.includes(raw) ? raw : fail(`Devise invalide : ${name}`)
  }
}

/** Champs reçus → données Prisma ; `partial` (modification) n'exige que les champs envoyés. */
export function parseFields(spec: Spec, body: Record<string, unknown>, partial: boolean): { data: Record<string, unknown> } | { error: string } {
  const data: Record<string, unknown> = {}
  try {
    for (const [name, field] of Object.entries(spec)) {
      if (!(name in body)) {
        if (!partial && "required" in field && field.required) throw new FieldError(`Champ requis : ${name}`)
        continue
      }
      let value = parseField(name, field, body[name])
      // Colonnes non vides en base : un champ vidé garde la valeur par défaut (ou 0 pour les frais)
      if (value === null && field.type === "money" && field.zero) value = 0
      if (value === null && (field.type === "enum" || field.type === "currency" || (field.type === "int" && field.notNull))) continue
      data[name] = field.type === "ids" ? (value as string[]) : value
    }
  } catch (error) {
    if (error instanceof FieldError) return { error: error.message }
    throw error
  }
  return { data }
}

export const TRIP_SPEC: Spec = {
  title: { type: "text", max: 120, required: true },
  destination: { type: "text", max: 160, required: true },
  startDate: { type: "day", required: true },
  endDate: { type: "day", required: true },
  abroad: { type: "bool" },
  cancelled: { type: "bool" },
  archived: { type: "bool" },
  currency: { type: "currency" },
  budget: { type: "money" },
  notes: { type: "long" },
}

export const COLLECTION_SPECS: Record<Collection, Spec> = {
  places: {
    name: { type: "text", max: 120, required: true },
    kind: { type: "enum", values: values(PLACE_KINDS) },
    status: { type: "enum", values: values(PLACE_STATUSES) },
    address: { type: "text", max: 300 },
    url: { type: "url" },
    lat: { type: "coord", max: 90 },
    lng: { type: "coord", max: 180 },
    day: { type: "day" },
    notes: { type: "long" },
  },
  activities: {
    day: { type: "day", required: true },
    startTime: { type: "time" },
    endTime: { type: "time" },
    title: { type: "text", max: 160, required: true },
    kind: { type: "enum", values: values(ACTIVITY_KINDS) },
    placeId: { type: "ref" },
    address: { type: "text", max: 300 },
    travelMinutes: { type: "int", min: 0, max: 1440 },
    bookingId: { type: "ref" },
    notes: { type: "long" },
    rainPlan: { type: "long" },
    done: { type: "bool" },
    order: { type: "int", min: -100_000, max: 100_000, notNull: true },
  },
  bookings: {
    type: { type: "enum", values: values(BOOKING_TYPES), required: true },
    status: { type: "enum", values: values(BOOKING_STATUSES) },
    title: { type: "text", max: 160, required: true },
    provider: { type: "text", max: 120 },
    reference: { type: "text", max: 120 },
    startAt: { type: "datetime" },
    endAt: { type: "datetime" },
    fromPlace: { type: "text", max: 160 },
    toPlace: { type: "text", max: 160 },
    address: { type: "text", max: 300 },
    url: { type: "url" },
    phone: { type: "text", max: 40 },
    cost: { type: "money" },
    paid: { type: "bool" },
    notes: { type: "long" },
  },
  expenses: {
    date: { type: "day", required: true },
    label: { type: "text", max: 160, required: true },
    category: { type: "enum", values: values(EXPENSE_CATEGORIES) },
    amount: { type: "money", required: true, positive: true },
    currency: { type: "currency" },
    rate: { type: "rate" },
    fees: { type: "money", zero: true },
    status: { type: "enum", values: values(EXPENSE_STATUSES) },
    paymentMethod: { type: "text", max: 40 },
    paidBy: { type: "ref" },
    splitWith: { type: "ids" },
    bookingId: { type: "ref" },
    notes: { type: "long" },
  },
  checklist: {
    category: { type: "enum", values: values(CHECKLIST_CATEGORIES) },
    title: { type: "text", max: 200, required: true },
    done: { type: "bool" },
    dueDate: { type: "day" },
    assignee: { type: "ref" },
    order: { type: "int", min: -100_000, max: 100_000, notNull: true },
  },
  journal: {
    date: { type: "day", required: true },
    title: { type: "text", max: 160 },
    text: { type: "long", max: 20_000, required: true },
    placeId: { type: "ref" },
  },
}

// Accès Prisma par collection (mêmes opérations pour toutes)
interface Delegate {
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Record<string, unknown>>
  findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>
  count(args: { where: Record<string, unknown> }): Promise<number>
}

export function delegateFor(collection: Collection): Delegate {
  const map = {
    places: prisma.tripPlace,
    activities: prisma.tripActivity,
    bookings: prisma.tripBooking,
    expenses: prisma.tripExpense,
    checklist: prisma.tripChecklistItem,
    journal: prisma.tripJournalEntry,
  }
  return map[collection] as unknown as Delegate
}

export const COLLECTION_LIMIT = 500
export const isCollection = (v: unknown): v is Collection => typeof v === "string" && v in COLLECTION_SPECS

/** Voyageurs : [{ id, name }] (au plus 20). */
export function parseTravelers(raw: unknown): Traveler[] | null {
  if (!Array.isArray(raw)) return null
  const list = raw
    .filter((t): t is { id: unknown; name: unknown } => !!t && typeof t === "object")
    .map((t) => ({ id: typeof t.id === "string" ? t.id.slice(0, 60) : "", name: typeof t.name === "string" ? t.name.trim().slice(0, 60) : "" }))
    .filter((t) => t.id && t.name)
  return list.slice(0, 20)
}

export function parseContacts(raw: unknown): TripContact[] | null {
  if (!Array.isArray(raw)) return null
  const kinds = values(CONTACT_KINDS)
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      id: typeof c.id === "string" ? c.id.slice(0, 60) : "",
      name: typeof c.name === "string" ? c.name.trim().slice(0, 100) : "",
      kind: typeof c.kind === "string" && kinds.includes(c.kind) ? c.kind : "other",
      phone: typeof c.phone === "string" && c.phone.trim() ? c.phone.trim().slice(0, 40) : null,
      note: typeof c.note === "string" && c.note.trim() ? c.note.trim().slice(0, 300) : null,
    }))
    .filter((c) => c.id && c.name)
    .slice(0, 30)
}

/** Destinations : [{ id, name, lat, lng, startDate?, endDate? }] (au plus 30, dans l'ordre). */
export function parseStops(raw: unknown): TripStop[] | null {
  if (!Array.isArray(raw)) return null
  const day = (v: unknown) => (isDay(v) ? v : null)
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      id: typeof s.id === "string" ? s.id.slice(0, 60) : "",
      name: typeof s.name === "string" ? s.name.trim().slice(0, 160) : "",
      lat: Number(s.lat),
      lng: Number(s.lng),
      startDate: day(s.startDate),
      endDate: day(s.endDate),
    }))
    .filter((s) => s.id && s.name && Number.isFinite(s.lat) && Number.isFinite(s.lng) && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180)
    .slice(0, 30)
}

export function parseCategoryBudgets(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const allowed = values(EXPENSE_CATEGORIES)
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."))
    if (allowed.includes(key) && Number.isFinite(n) && n > 0 && n < 100_000_000) out[key] = Math.round(n * 100) / 100
  }
  return out
}

// ─── Mise en forme ───────────────────────────────────────────────────────────

const USER_SELECT = { id: true, name: true, email: true } as const
export const FILE_SELECT = { id: true, name: true, mimeType: true, size: true, tripItemId: true, createdAt: true } as const

/** Voyages visibles : ceux qu'on a créés et ceux partagés avec nous. */
export const tripAccessWhere = (userId: string): Prisma.TripWhereInput => ({ OR: [{ userId }, { members: { some: { userId } } }] })

export async function accessibleTrip(tripId: unknown, userId: string) {
  if (typeof tripId !== "string") return null
  return prisma.trip.findFirst({ where: { id: tripId, ...tripAccessWhere(userId) }, select: { id: true, userId: true, title: true } })
}

export const TRIP_INCLUDE = {
  places: { orderBy: { createdAt: "asc" } },
  activities: { orderBy: [{ day: "asc" }, { order: "asc" }, { createdAt: "asc" }] },
  bookings: { orderBy: [{ startAt: "asc" }, { createdAt: "asc" }] },
  expenses: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
  checklist: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
  journal: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
  attachments: { select: FILE_SELECT, orderBy: { createdAt: "desc" } },
  user: { select: USER_SELECT },
  members: { include: { user: { select: USER_SELECT } }, orderBy: { createdAt: "asc" } },
  documentLinks: {
    include: { user: { select: USER_SELECT }, document: { include: { attachments: { select: FILE_SELECT, orderBy: { createdAt: "desc" } } } } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.TripInclude

type DbTrip = Prisma.TripGetPayload<{ include: typeof TRIP_INCLUDE }>

const strip = <T extends { userId: string; tripId: string; createdAt: Date }>({ userId, tripId, createdAt, ...rest }: T) => rest

const fileOut = (a: { id: string; name: string; mimeType: string; size: number; tripItemId: string | null; createdAt: Date }) => ({ ...a, createdAt: a.createdAt.toISOString() })

export function serializeDocument(d: { id: string; title: string; category: string; number: string | null; holder: string | null; issuedAt: string | null; expiresAt: string | null; notes: string | null; attachments: Parameters<typeof fileOut>[0][] }) {
  return { id: d.id, title: d.title, category: d.category, number: d.number, holder: d.holder, issuedAt: d.issuedAt, expiresAt: d.expiresAt, notes: d.notes, files: d.attachments.map(fileOut) }
}

/** Voyage vu par `viewerId` : ses documents privés et ceux que les autres membres partagent. */
export function serializeTrip(trip: DbTrip, viewerId: string): Trip {
  // Qui montre tous ses documents liés au voyage (réglage du créateur et de chaque membre)
  const sharesAll = new Set([...(trip.ownerShareDocs ? [trip.userId] : []), ...trip.members.filter((m) => m.shareDocs).map((m) => m.userId)])
  return {
    id: trip.id,
    ownerId: trip.userId,
    ownerName: displayName(trip.user),
    mine: trip.userId === viewerId,
    members: trip.members.map((m) => ({ userId: m.userId, name: displayName(m.user) })),
    documents: trip.documentLinks
      .filter((l) => l.userId === viewerId || l.shared || sharesAll.has(l.userId))
      .map((l) => ({
        ...serializeDocument(l.document),
        documentId: l.documentId,
        ownerId: l.userId,
        ownerName: displayName(l.user),
        mine: l.userId === viewerId,
        shared: l.shared || sharesAll.has(l.userId),
      })),
    stops: parseStops(trip.stops) ?? [],
    shareMyDocs: sharesAll.has(viewerId),
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    abroad: trip.abroad,
    cancelled: trip.cancelled,
    archived: trip.archived,
    currency: trip.currency,
    budget: trip.budget,
    categoryBudgets: parseCategoryBudgets(trip.categoryBudgets) ?? {},
    travelers: parseTravelers(trip.travelers) ?? [],
    contacts: parseContacts(trip.contacts) ?? [],
    notes: trip.notes,
    places: trip.places.map(strip),
    activities: trip.activities.map(strip),
    bookings: trip.bookings.map(strip),
    expenses: trip.expenses.map((e) => ({ ...strip(e), splitWith: Array.isArray(e.splitWith) ? (e.splitWith as string[]) : [] })),
    checklist: trip.checklist.map(strip),
    journal: trip.journal.map(strip),
    attachments: trip.attachments.map(fileOut),
  }
}

export function checkDates(startDate: string, endDate: string) {
  if (endDate < startDate) return "Le retour doit suivre le départ"
  if (daysBetween(startDate, endDate) > 365) return "Voyage trop long (un an au plus)"
  return null
}

// ─── Alertes ─────────────────────────────────────────────────────────────────

const isQuiet = (h: number, start: number, end: number) => (start > end ? h >= start || h < end : h >= start && h < end)

// Heure locale "AAAA-MM-JJTHH:mm" dans le fuseau de l'utilisateur
function nowIn(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date())
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
  } catch {
    return new Date().toISOString().slice(0, 16)
  }
}

const shiftMinutes = (localDateTime: string, minutes: number) =>
  new Date(new Date(`${localDateTime}:00Z`).getTime() + minutes * 60_000).toISOString().slice(0, 16)

interface TripAlert {
  dedupeKey: string
  title: string
  body?: string
}

/** Alertes du moment pour les voyages d'un utilisateur. */
export function computeTripAlerts(trips: Trip[], today: string, now: string): TripAlert[] {
  const alerts: TripAlert[] = []
  for (const trip of trips) {
    if (trip.cancelled || trip.archived || today > trip.endDate) continue
    if (today === addDays(trip.startDate, -1)) alerts.push({ dedupeKey: `trip:eve:${trip.id}:${trip.startDate}`, title: `Départ demain : ${trip.title}`, body: trip.destination })
    for (const d of tripDeadlines(trip, today)) {
      // Le jour même (ou un retard de moins de 3 jours) ; les départs ont leur propre rappel ci-dessous
      if (d.kind === "departure" || d.day > today || d.day < addDays(today, -3)) continue
      alerts.push({ dedupeKey: `trip:${d.key}:${d.day}`, title: d.title, body: [trip.title, d.detail].filter(Boolean).join(" · ") })
    }
    // Départ vers la gare ou l'aéroport : 3 h avant l'horaire du transport
    for (const b of trip.bookings) {
      if (b.status === "cancelled" || !b.startAt || !["flight", "train", "bus", "ferry"].includes(b.type)) continue
      if (now >= shiftMinutes(b.startAt, -180) && now < b.startAt) {
        alerts.push({
          dedupeKey: `trip:go:${b.id}:${b.startAt}`,
          title: `Départ à ${b.startAt.slice(11, 16)} : ${b.title}`,
          body: [b.fromPlace, b.reference ? `Réf. ${b.reference}` : null, formatDateTime(b.startAt)].filter(Boolean).join(" · "),
        })
      }
    }
  }
  return alerts
}

export async function runTripAlerts(userId: string) {
  const prefs = await getAlertPrefs(userId)
  if (!prefs.enabled || isQuiet(hourIn(prefs.timeZone), prefs.quietStart, prefs.quietEnd)) return { created: 0, pushed: 0 }

  const today = dayKey(new Date(), prefs.timeZone)
  const trips = await prisma.trip.findMany({
    where: { ...tripAccessWhere(userId), cancelled: false, archived: false, endDate: { gte: today }, startDate: { lte: addDays(today, 60) } },
    include: TRIP_INCLUDE,
  })
  const alerts = computeTripAlerts(trips.map((t) => serializeTrip(t, userId)), today, nowIn(prefs.timeZone))
  if (!alerts.length) return { created: 0, pushed: 0 }

  const sent = await prisma.sentAlert.findMany({ where: { userId, dedupeKey: { in: alerts.map((a) => a.dedupeKey) } }, select: { dedupeKey: true } })
  const already = new Set(sent.map((s) => s.dedupeKey))
  const fresh = alerts.filter((a) => !already.has(a.dedupeKey))
  if (!fresh.length) return { created: 0, pushed: 0 }

  await prisma.sentAlert.createMany({ data: fresh.map((a) => ({ userId, dedupeKey: a.dedupeKey })), skipDuplicates: true })
  await prisma.notification.createMany({
    data: fresh.map((a) => ({ userId, type: "trip" as const, title: a.title.slice(0, 200), body: a.body ?? null, link: "travel", dedupeKey: `alert:${a.dedupeKey}` })),
    skipDuplicates: true,
  })
  let pushed = 0
  if (prefs.push) {
    for (const a of fresh.slice(0, 3)) pushed += await sendPushToUser(userId, { title: a.title.slice(0, 120), body: a.body, url: "/?page=travel", tag: a.dedupeKey })
  }
  return { created: fresh.length, pushed }
}

export async function runTripAlertsForAllUsers() {
  const today = new Date().toISOString().slice(0, 10)
  // Créateurs et membres des voyages pas encore terminés
  const trips = await prisma.trip.findMany({
    where: { cancelled: false, archived: false, endDate: { gte: addDays(today, -1) } },
    select: { userId: true, members: { select: { userId: true } } },
  })
  const users = new Set(trips.flatMap((t) => [t.userId, ...t.members.map((m) => m.userId)]))
  let created = 0
  for (const userId of users) {
    try {
      created += (await runTripAlerts(userId)).created
    } catch (error) {
      console.error(`Trip alerts failed for ${userId}:`, error)
    }
  }
  return created
}
