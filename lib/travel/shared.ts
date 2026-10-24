// Voyages : types, libellés et calculs partagés entre le serveur et l'interface.
// Jours "AAAA-MM-JJ" et heures locales "AAAA-MM-JJTHH:mm" (heure du lieu, sans fuseau).

export interface Traveler {
  id: string
  name: string
}

export interface TripContact {
  id: string
  name: string
  kind: string
  phone: string | null
  note: string | null
}

export interface TripPlace {
  id: string
  name: string
  kind: string
  status: string
  address: string | null
  url: string | null
  lat: number | null
  lng: number | null
  day: string | null
  notes: string | null
}

export interface TripActivity {
  id: string
  day: string
  startTime: string | null
  endTime: string | null
  title: string
  kind: string
  placeId: string | null
  address: string | null
  travelMinutes: number | null
  bookingId: string | null
  notes: string | null
  rainPlan: string | null
  done: boolean
  order: number
}

export interface TripBooking {
  id: string
  type: string
  status: string
  title: string
  provider: string | null
  reference: string | null
  startAt: string | null
  endAt: string | null
  fromPlace: string | null
  toPlace: string | null
  address: string | null
  url: string | null
  phone: string | null
  cost: number | null
  paid: boolean
  notes: string | null
}

export interface TripExpense {
  id: string
  date: string
  label: string
  category: string
  amount: number
  currency: string
  rate: number
  fees: number
  status: string
  paymentMethod: string | null
  paidBy: string | null
  splitWith: string[]
  bookingId: string | null
  notes: string | null
}

export interface TripChecklistItem {
  id: string
  category: string
  title: string
  done: boolean
  dueDate: string | null
  assignee: string | null
  order: number
}

export interface TripJournalEntry {
  id: string
  date: string
  title: string | null
  text: string
  placeId: string | null
}

export interface TripAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  tripItemId: string | null
  createdAt: string
}

export interface TripMember {
  userId: string
  name: string
}

/** Destination du voyage (une ville, une région…) ; plusieurs, dans l'ordre, pour un road trip. */
export interface TripStop {
  id: string
  name: string
  lat: number
  lng: number
  startDate: string | null
  endDate: string | null
}

/** Document de la bibliothèque personnelle (passeport, carte d'identité, assurance…). */
export interface TravelDocument {
  id: string
  title: string
  category: string
  number: string | null
  holder: string | null
  issuedAt: string | null
  expiresAt: string | null
  notes: string | null
  files: TripAttachment[]
}

/** Document de la bibliothèque utilisé pour ce voyage (les miens, et ceux que les membres partagent). */
export interface TripDocument extends TravelDocument {
  documentId: string
  ownerId: string
  ownerName: string
  mine: boolean
  shared: boolean
}

export interface Trip {
  id: string
  // Créateur du voyage (seul à gérer le partage et la suppression)
  ownerId: string
  ownerName: string
  mine: boolean
  members: TripMember[]
  documents: TripDocument[]
  stops: TripStop[]
  // Je montre tous mes documents liés à ce voyage aux autres membres
  shareMyDocs: boolean
  title: string
  destination: string
  startDate: string
  endDate: string
  abroad: boolean
  cancelled: boolean
  archived: boolean
  currency: string
  budget: number | null
  categoryBudgets: Record<string, number>
  travelers: Traveler[]
  contacts: TripContact[]
  notes: string | null
  places: TripPlace[]
  activities: TripActivity[]
  bookings: TripBooking[]
  expenses: TripExpense[]
  checklist: TripChecklistItem[]
  journal: TripJournalEntry[]
  attachments: TripAttachment[]
}

export type Collection = "places" | "activities" | "bookings" | "expenses" | "checklist" | "journal"

// ─── Libellés ────────────────────────────────────────────────────────────────

type Option = { value: string; label: string }

export const PLACE_KINDS: Option[] = [
  { value: "lodging", label: "Hébergement" },
  { value: "restaurant", label: "Restaurant" },
  { value: "visit", label: "Visite" },
  { value: "activity", label: "Activité" },
  { value: "station", label: "Gare" },
  { value: "airport", label: "Aéroport" },
  { value: "parking", label: "Parking" },
  { value: "other", label: "Autre" },
]

export const PLACE_STATUSES: Option[] = [
  { value: "todo", label: "À visiter" },
  { value: "booked", label: "Réservé" },
  { value: "visited", label: "Visité" },
]

export const ACTIVITY_KINDS: Option[] = [
  { value: "activity", label: "Activité" },
  { value: "visit", label: "Visite" },
  { value: "restaurant", label: "Restaurant" },
  { value: "poi", label: "Point d'intérêt" },
  { value: "transport", label: "Trajet" },
  { value: "rest", label: "Pause" },
  { value: "other", label: "Autre" },
]

export const BOOKING_TYPES: (Option & { group: "transport" | "lodging" | "car" | "activity" | "other" })[] = [
  { value: "flight", label: "Vol", group: "transport" },
  { value: "train", label: "Train", group: "transport" },
  { value: "bus", label: "Bus", group: "transport" },
  { value: "ferry", label: "Ferry", group: "transport" },
  { value: "lodging", label: "Hôtel", group: "lodging" },
  { value: "rental", label: "Location", group: "lodging" },
  { value: "car", label: "Voiture de location", group: "car" },
  { value: "transfer", label: "Transfert", group: "car" },
  { value: "parking", label: "Parking", group: "car" },
  { value: "ticket", label: "Billet d'entrée", group: "activity" },
  { value: "excursion", label: "Excursion", group: "activity" },
  { value: "activity", label: "Activité", group: "activity" },
  { value: "other", label: "Autre", group: "other" },
]

export const BOOKING_GROUPS: Option[] = [
  { value: "transport", label: "Transports" },
  { value: "lodging", label: "Hébergements" },
  { value: "car", label: "Voitures, transferts, parkings" },
  { value: "activity", label: "Billets et activités" },
  { value: "other", label: "Autres" },
]

export const BOOKING_STATUSES: Option[] = [
  { value: "todo", label: "À réserver" },
  { value: "booked", label: "Réservé" },
  { value: "confirmed", label: "Confirmé" },
  { value: "cancelled", label: "Annulé" },
]

export const EXPENSE_CATEGORIES: Option[] = [
  { value: "transport", label: "Transport principal" },
  { value: "local_transport", label: "Transports sur place" },
  { value: "lodging", label: "Hébergement et taxes" },
  { value: "food", label: "Restaurants" },
  { value: "groceries", label: "Courses" },
  { value: "activities", label: "Activités et visites" },
  { value: "car", label: "Parking, carburant, péages" },
  { value: "luggage", label: "Bagages" },
  { value: "insurance", label: "Assurance" },
  { value: "fees", label: "Frais bancaires" },
  { value: "shopping", label: "Achats et souvenirs" },
  { value: "other", label: "Imprévus et autres" },
]

export const EXPENSE_STATUSES: Option[] = [
  { value: "planned", label: "Prévu" },
  { value: "booked", label: "Réservé" },
  { value: "paid", label: "Payé" },
]

export const PAYMENT_METHODS = ["Carte", "Espèces", "Virement", "PayPal", "Autre"]

export const CHECKLIST_CATEGORIES: Option[] = [
  { value: "documents", label: "Documents et formalités" },
  { value: "visa", label: "Visa et autorisations" },
  { value: "health", label: "Assurance et santé" },
  { value: "luggage", label: "Bagages et vêtements" },
  { value: "tech", label: "Téléphone et connectivité" },
  { value: "home", label: "Maison avant le départ" },
  { value: "checkin", label: "Enregistrement et horaires" },
  { value: "other", label: "Autres" },
]

export const DOC_CATEGORIES: Option[] = [
  { value: "passport", label: "Passeport" },
  { value: "identity", label: "Carte d'identité" },
  { value: "visa", label: "Visa / autorisation" },
  { value: "insurance", label: "Assurance / assistance" },
  { value: "health", label: "Santé / vaccination" },
  { value: "driving", label: "Permis de conduire" },
  { value: "card", label: "Carte (fidélité, réduction…)" },
  { value: "other", label: "Autre" },
]

/**
 * Validité d'un document pour un voyage : expiré au retour, ou passeport valable moins de 6 mois après
 * le retour (exigé par de nombreux pays).
 */
export function documentValidity(doc: Pick<TravelDocument, "expiresAt" | "category">, trip?: Pick<Trip, "endDate" | "abroad">, today = localDay()) {
  if (!doc.expiresAt) return null
  if (doc.expiresAt < today) return { level: "expired" as const, label: "Expiré" }
  if (trip && doc.expiresAt < trip.endDate) return { level: "expired" as const, label: "Expire avant le retour" }
  if (trip?.abroad && doc.category === "passport" && doc.expiresAt < addDays(trip.endDate, 182)) return { level: "warning" as const, label: "Moins de 6 mois après le retour" }
  if (!trip && doc.expiresAt < addDays(today, 182)) return { level: "warning" as const, label: "Expire dans moins de 6 mois" }
  return null
}

export const CONTACT_KINDS: Option[] = [
  { value: "emergency", label: "Urgence" },
  { value: "consulate", label: "Consulat / ambassade" },
  { value: "insurance", label: "Assurance / assistance" },
  { value: "lodging", label: "Hébergement" },
  { value: "other", label: "Autre" },
]

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "JPY", "AUD", "MAD", "TND", "THB", "MXN", "BRL", "CNY", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "TRY", "ZAR", "AED", "INR", "IDR", "SGD", "NZD", "KRW", "MUR"]

export const labelOf = (options: Option[], value: string | null | undefined) => options.find((o) => o.value === value)?.label ?? value ?? ""
export const bookingGroup = (type: string) => BOOKING_TYPES.find((t) => t.value === type)?.group ?? "other"
export const isTransport = (type: string) => bookingGroup(type) === "transport"

// Sources officielles (formalités, sécurité, santé)
export const OFFICIAL_LINKS = [
  { name: "Conseils aux voyageurs (France Diplomatie)", url: "https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/" },
  { name: "Formalités et préparer son départ", url: "https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/preparer-son-depart/" },
  { name: "S'inscrire sur Ariane", url: "https://pastel.diplomatie.gouv.fr/fildariane/" },
  { name: "Santé du voyageur (Institut Pasteur)", url: "https://www.pasteur.fr/fr/centre-medical/preparer-son-voyage" },
]

// ─── Dates ───────────────────────────────────────────────────────────────────

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

const parseDay = (day: string) => {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(day: string, n: number) {
  const d = parseDay(day)
  d.setDate(d.getDate() + n)
  return localDay(d)
}

export function daysBetween(from: string, to: string) {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000)
}

/** Jours du voyage, du départ au retour inclus (au plus 120). */
export function tripDays(trip: Pick<Trip, "startDate" | "endDate">) {
  const n = Math.min(Math.max(daysBetween(trip.startDate, trip.endDate), 0), 119)
  return Array.from({ length: n + 1 }, (_, i) => addDays(trip.startDate, i))
}

export function formatDay(day: string, withYear = false) {
  return parseDay(day).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) })
}

export function formatRange(start: string, end: string) {
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
  const a = parseDay(start).toLocaleDateString("fr-FR", sameYear ? opts : { ...opts, year: "numeric" })
  const b = parseDay(end).toLocaleDateString("fr-FR", { ...opts, year: "numeric" })
  return start === end ? b : `${a} → ${b}`
}

/** "AAAA-MM-JJTHH:mm" → "lun. 3 mars, 14:05" */
export function formatDateTime(value: string | null) {
  if (!value) return ""
  const day = value.slice(0, 10)
  const time = value.slice(11, 16)
  return `${formatDay(day)}${time ? `, ${time}` : ""}`
}

export const toMinutes = (time: string | null) => {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

export type TripPhase = "upcoming" | "ongoing" | "past" | "cancelled"

export function tripPhase(trip: Pick<Trip, "startDate" | "endDate" | "cancelled">, today = localDay()): TripPhase {
  if (trip.cancelled) return "cancelled"
  if (today < trip.startDate) return "upcoming"
  if (today > trip.endDate) return "past"
  return "ongoing"
}

export const PHASE_LABELS: Record<TripPhase, string> = { upcoming: "À venir", ongoing: "En cours", past: "Passé", cancelled: "Annulé" }

export function countdown(trip: Pick<Trip, "startDate" | "endDate" | "cancelled">, today = localDay()) {
  const phase = tripPhase(trip, today)
  if (phase === "upcoming") {
    const n = daysBetween(today, trip.startDate)
    return n === 1 ? "Départ demain" : `Départ dans ${n} jours`
  }
  if (phase === "ongoing") {
    const day = daysBetween(trip.startDate, today) + 1
    const total = daysBetween(trip.startDate, trip.endDate) + 1
    return `Jour ${day} sur ${total}`
  }
  if (phase === "past") return `Rentré le ${formatDay(trip.endDate, true)}`
  return "Annulé"
}

// ─── Argent ──────────────────────────────────────────────────────────────────

export function formatMoney(value: number, currency = "EUR") {
  try {
    return value.toLocaleString("fr-FR", { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 2 : 0 })
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

/** Montant d'une dépense dans la devise du voyage, frais compris. */
export const expenseTotal = (e: Pick<TripExpense, "amount" | "rate" | "fees">) => Math.round((e.amount * (e.rate || 1) + (e.fees || 0)) * 100) / 100

export interface BudgetStats {
  budget: number | null
  planned: number
  booked: number
  paid: number
  committed: number
  remaining: number | null
  byCategory: Map<string, { spent: number; limit: number | null }>
  byDay: Map<string, number>
}

/**
 * Budget du voyage : dépenses (prévues, réservées, payées) et coûts des réservations sans dépense
 * associée (pour ne pas compter deux fois le même billet).
 */
export function budgetStats(trip: Pick<Trip, "budget" | "categoryBudgets" | "expenses" | "bookings">): BudgetStats {
  const byCategory = new Map<string, { spent: number; limit: number | null }>()
  for (const [cat, limit] of Object.entries(trip.categoryBudgets)) byCategory.set(cat, { spent: 0, limit })
  const byDay = new Map<string, number>()
  const totals = { planned: 0, booked: 0, paid: 0 }
  const add = (category: string, status: string, amount: number, day?: string) => {
    const key = status === "planned" ? "planned" : status === "paid" ? "paid" : "booked"
    totals[key] += amount
    const cat = byCategory.get(category) ?? { spent: 0, limit: null }
    cat.spent += amount
    byCategory.set(category, cat)
    if (day && status === "paid") byDay.set(day, (byDay.get(day) || 0) + amount)
  }
  const linked = new Set(trip.expenses.map((e) => e.bookingId).filter(Boolean))
  for (const e of trip.expenses) add(e.category, e.status, expenseTotal(e), e.date)
  for (const b of trip.bookings) {
    if (b.cost == null || b.status === "cancelled" || linked.has(b.id)) continue
    const category = isTransport(b.type) ? "transport" : bookingGroup(b.type) === "lodging" ? "lodging" : bookingGroup(b.type) === "car" ? "car" : "activities"
    add(category, b.paid ? "paid" : b.status === "todo" ? "planned" : "booked", b.cost)
  }
  const committed = totals.planned + totals.booked + totals.paid
  const round = (n: number) => Math.round(n * 100) / 100
  return {
    budget: trip.budget,
    planned: round(totals.planned),
    booked: round(totals.booked),
    paid: round(totals.paid),
    committed: round(committed),
    remaining: trip.budget != null ? round(trip.budget - committed) : null,
    byCategory,
    byDay,
  }
}

/**
 * Soldes entre voyageurs (positif = on lui doit) et remboursements à faire, en un minimum de virements.
 * Les dépenses sans payeur ne comptent pas.
 */
export function settleUp(trip: Pick<Trip, "travelers" | "expenses">) {
  const ids = trip.travelers.map((t) => t.id)
  const balance = new Map(ids.map((id) => [id, 0]))
  for (const e of trip.expenses) {
    if (!e.paidBy || !balance.has(e.paidBy) || e.status === "planned") continue
    const share = (e.splitWith.length ? e.splitWith : ids).filter((id) => balance.has(id))
    if (!share.length) continue
    const total = expenseTotal(e)
    balance.set(e.paidBy, (balance.get(e.paidBy) || 0) + total)
    for (const id of share) balance.set(id, (balance.get(id) || 0) - total / share.length)
  }
  const round = (n: number) => Math.round(n * 100) / 100
  const debtors = [...balance].filter(([, v]) => v < -0.005).map(([id, v]) => ({ id, v: -v }))
  const creditors = [...balance].filter(([, v]) => v > 0.005).map(([id, v]) => ({ id, v }))
  debtors.sort((a, b) => b.v - a.v)
  creditors.sort((a, b) => b.v - a.v)
  const transfers: { from: string; to: string; amount: number }[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].v, creditors[j].v)
    if (amount > 0.005) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: round(amount) })
    debtors[i].v -= amount
    creditors[j].v -= amount
    if (debtors[i].v < 0.005) i++
    if (creditors[j].v < 0.005) j++
  }
  return { balances: new Map([...balance].map(([id, v]) => [id, round(v)])), transfers }
}

// ─── Échéances et contrôles ──────────────────────────────────────────────────

export interface Deadline {
  key: string
  day: string
  title: string
  detail?: string
  kind: "checklist" | "booking" | "checkin" | "departure" | "documents" | "luggage"
  overdue: boolean
}

/**
 * Échéances calculées à partir du départ : préparatifs datés, réservations à faire,
 * enregistrement en ligne des vols (la veille), bagages (la veille) et départ vers la gare ou l'aéroport.
 */
export function tripDeadlines(trip: Trip, today = localDay()): Deadline[] {
  if (trip.cancelled || today > trip.endDate) return []
  const list: Deadline[] = []
  const push = (d: Omit<Deadline, "overdue">) => list.push({ ...d, overdue: d.day < today })

  for (const item of trip.checklist) {
    if (!item.done && item.dueDate) push({ key: `check:${item.id}`, day: item.dueDate, title: item.title, detail: labelOf(CHECKLIST_CATEGORIES, item.category), kind: "checklist" })
  }
  if (today < trip.startDate) {
    const todo = trip.bookings.filter((b) => b.status === "todo")
    if (todo.length) {
      push({
        key: `book:${trip.id}`,
        day: addDays(trip.startDate, -14),
        title: `${todo.length} réservation${todo.length > 1 ? "s" : ""} à faire`,
        detail: todo.slice(0, 3).map((b) => b.title).join(", "),
        kind: "booking",
      })
    }
    if (trip.abroad && !trip.checklist.some((c) => c.category === "documents" && c.dueDate)) {
      push({ key: `docs:${trip.id}`, day: addDays(trip.startDate, -30), title: "Vérifier passeport, visa et assurance", kind: "documents" })
    }
    for (const doc of trip.documents.filter((d) => d.mine)) {
      const validity = documentValidity(doc, trip, today)
      if (validity) push({ key: `doc:${doc.documentId}`, day: addDays(trip.startDate, -45) < today ? today : addDays(trip.startDate, -45), title: `${doc.title} : ${validity.label.toLowerCase()}`, detail: "À renouveler avant le départ", kind: "documents" })
    }
    if (!trip.checklist.some((c) => c.category === "luggage" && c.dueDate)) {
      push({ key: `bags:${trip.id}`, day: addDays(trip.startDate, -1), title: "Préparer les bagages", kind: "luggage" })
    }
  }
  for (const b of trip.bookings) {
    if (b.status === "cancelled" || !b.startAt || !isTransport(b.type)) continue
    const day = b.startAt.slice(0, 10)
    if (b.type === "flight") push({ key: `checkin:${b.id}`, day: addDays(day, -1), title: `Enregistrement en ligne : ${b.title}`, detail: formatDateTime(b.startAt), kind: "checkin" })
    push({ key: `go:${b.id}`, day, title: `Départ : ${b.title}`, detail: `${formatDateTime(b.startAt)}${b.fromPlace ? ` · ${b.fromPlace}` : ""}`, kind: "departure" })
  }
  return list.filter((d) => d.day >= today || d.kind === "checklist").sort((a, b) => a.day.localeCompare(b.day))
}

/** Activités qui se chevauchent, ou trop proches pour le trajet prévu (marge de 10 min). */
export function scheduleConflicts(activities: TripActivity[]) {
  const issues = new Map<string, string>()
  const byDay = new Map<string, TripActivity[]>()
  for (const a of activities) byDay.set(a.day, [...(byDay.get(a.day) || []), a])
  for (const list of byDay.values()) {
    const timed = list.filter((a) => toMinutes(a.startTime) != null).sort((a, b) => (toMinutes(a.startTime) as number) - (toMinutes(b.startTime) as number))
    for (let i = 1; i < timed.length; i++) {
      const prev = timed[i - 1]
      const cur = timed[i]
      const prevEnd = toMinutes(prev.endTime) ?? toMinutes(prev.startTime) as number
      const start = toMinutes(cur.startTime) as number
      const needed = (cur.travelMinutes || 0) + (cur.travelMinutes ? 10 : 0)
      if (start < prevEnd) issues.set(cur.id, `Chevauche « ${prev.title} »`)
      else if (needed && start - prevEnd < needed) issues.set(cur.id, `Peu de marge après « ${prev.title} » (${start - prevEnd} min pour ${cur.travelMinutes} min de trajet)`)
    }
  }
  return issues
}

/** Tri d'une journée : heure de début, puis ordre manuel. */
export function sortActivities(list: TripActivity[]) {
  return [...list].sort((a, b) => {
    const ta = toMinutes(a.startTime)
    const tb = toMinutes(b.startTime)
    if (ta != null && tb != null && ta !== tb) return ta - tb
    if (ta != null && tb == null) return -1
    if (ta == null && tb != null) return 1
    return a.order - b.order
  })
}

// ─── Carte ───────────────────────────────────────────────────────────────────

/** Distance à vol d'oiseau, en km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`)

/** Coordonnées tirées d'un texte « 48.85, 2.35 » ou d'un lien Google Maps / OpenStreetMap. */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, // google.com/maps/@lat,lng
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // lieu Google Maps
    /[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i,
    /[?&#]mlat=(-?\d{1,2}\.\d+)&mlon=(-?\d{1,3}\.\d+)/, // openstreetmap.org
    /#map=\d+\/(-?\d{1,2}\.\d+)\/(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,2}\.\d+)\s*[,; ]\s*(-?\d{1,3}\.\d+)\s*$/,
  ]
  for (const re of patterns) {
    const m = input.match(re)
    if (m) {
      const lat = Number(m[1])
      const lng = Number(m[2])
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
  }
  return null
}

/** Itinéraire dans Google Maps (ouvre l'application de navigation sur téléphone). */
export function directionsUrl(destination: { lat: number | null; lng: number | null; address?: string | null; name?: string }, waypoints: { lat: number; lng: number }[] = []) {
  const dest = destination.lat != null && destination.lng != null ? `${destination.lat},${destination.lng}` : destination.address || destination.name || ""
  const params = new URLSearchParams({ api: "1", destination: dest })
  if (waypoints.length) params.set("waypoints", waypoints.map((w) => `${w.lat},${w.lng}`).join("|"))
  return `https://www.google.com/maps/dir/?${params}`
}

// ─── Préparatifs par défaut ──────────────────────────────────────────────────

/** Checklist type, datée à partir du départ ; les formalités ne sont proposées que pour l'étranger. */
export function defaultChecklist(startDate: string, abroad: boolean): Omit<TripChecklistItem, "id" | "order">[] {
  const item = (category: string, title: string, daysBefore: number | null) => ({
    category,
    title,
    done: false,
    dueDate: daysBefore == null ? null : addDays(startDate, -daysBefore),
    assignee: null,
  })
  return [
    item("documents", "Carte d'identité valide", 30),
    ...(abroad
      ? [
          item("documents", "Passeport (vérifier la date de validité)", 45),
          item("visa", "Visa ou autorisation de voyage (selon la destination)", 45),
          item("health", "Vaccins et informations sanitaires", 30),
          item("documents", "Permis de conduire international si besoin", 30),
          item("tech", "Forfait ou eSIM à l'étranger", 7),
          item("tech", "Adaptateur de prise", 3),
        ]
      : []),
    item("health", "Assurance voyage et assistance", 14),
    item("health", "Médicaments habituels et trousse de secours", 3),
    item("luggage", "Vêtements et chaussures", 1),
    item("luggage", "Trousse de toilette", 1),
    item("tech", "Téléphone, chargeurs et batterie externe", 1),
    item("home", "Plantes, courrier, poubelles, électricité", 1),
    item("checkin", "Enregistrement en ligne et vérification des horaires", 1),
    item("documents", "Billets et réservations accessibles hors connexion", 1),
  ]
}

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
