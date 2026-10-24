"use client"

import { useMemo, useState } from "react"
import {
  ArrowLeftRight,
  ArrowRight,
  BedDouble,
  Bus,
  CalendarPlus,
  Car,
  ExternalLink,
  FileText,
  Home,
  Loader2,
  MapPin,
  Mountain,
  Pencil,
  Phone,
  Plane,
  Plus,
  Ship,
  SquareParking,
  Sparkles,
  Ticket,
  TrainFront,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DeleteButton } from "@/components/delete-button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  BOOKING_GROUPS,
  BOOKING_STATUSES,
  BOOKING_TYPES,
  bookingGroup,
  directionsUrl,
  formatDateTime,
  formatMoney,
  labelOf,
  type TripBooking,
} from "@/lib/travel/shared"
import { useTravel, useTrip } from "./context"
import { TripFiles } from "./files"
import { ActionsMenu, CopyText, Empty, Field, StatusBadge } from "./ui"

export const BOOKING_ICONS: Record<string, LucideIcon> = {
  flight: Plane,
  train: TrainFront,
  bus: Bus,
  ferry: Ship,
  lodging: BedDouble,
  rental: Home,
  car: Car,
  transfer: ArrowLeftRight,
  parking: SquareParking,
  ticket: Ticket,
  excursion: Mountain,
  activity: Sparkles,
  other: FileText,
}

type Filter = "all" | "todo" | "done" | "cancelled"

export function BookingsView() {
  const trip = useTrip()
  const { offlineSince } = useTravel()
  const [filter, setFilter] = useState<Filter>("all")
  const [editing, setEditing] = useState<TripBooking | "new" | null>(null)

  const shown = useMemo(
    () =>
      trip.bookings.filter((b) =>
        filter === "all" ? true : filter === "todo" ? b.status === "todo" : filter === "done" ? b.status === "booked" || b.status === "confirmed" : b.status === "cancelled"
      ),
    [trip.bookings, filter]
  )
  const counts = {
    todo: trip.bookings.filter((b) => b.status === "todo").length,
    done: trip.bookings.filter((b) => b.status === "booked" || b.status === "confirmed").length,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} aria-label="Réservations affichées">
          <ToggleGroupItem value="all">Toutes</ToggleGroupItem>
          <ToggleGroupItem value="todo">À réserver {counts.todo || ""}</ToggleGroupItem>
          <ToggleGroupItem value="done">Réservées {counts.done || ""}</ToggleGroupItem>
          <ToggleGroupItem value="cancelled">Annulées</ToggleGroupItem>
        </ToggleGroup>
        <Button size="sm" className="ml-auto" onClick={() => setEditing("new")} disabled={!!offlineSince}>
          <Plus className="size-4" />
          Ajouter une réservation
        </Button>
      </div>

      {shown.length === 0 ? (
        <Empty>Vols, trains, hôtels, locations, voitures, billets… ajoute tes réservations pour tout retrouver ici.</Empty>
      ) : (
        BOOKING_GROUPS.map((group) => {
          const list = shown.filter((b) => bookingGroup(b.type) === group.value)
          if (!list.length) return null
          return (
            <div key={group.value} className="space-y-2">
              <h2 className="text-sm font-semibold">{group.label}</h2>
              <div className="grid gap-3 @3xl/main:grid-cols-2">
                {list.map((b) => (
                  <BookingCard key={b.id} booking={b} onEdit={() => setEditing(b)} />
                ))}
              </div>
            </div>
          )
        })
      )}

      {editing && <BookingDialog booking={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function BookingCard({ booking: b, onEdit }: { booking: TripBooking; onEdit: () => void }) {
  const trip = useTrip()
  const { updateItem, removeItem, addItem, offlineSince } = useTravel()
  const { toast } = useToast()
  const Icon = BOOKING_ICONS[b.type] ?? FileText
  const inItinerary = trip.activities.some((a) => a.bookingId === b.id)

  const addToItinerary = async () => {
    if (!b.startAt) return
    const saved = await addItem("activities", {
      day: b.startAt.slice(0, 10),
      startTime: b.startAt.slice(11, 16) || null,
      endTime: b.endAt && b.endAt.slice(0, 10) === b.startAt.slice(0, 10) ? b.endAt.slice(11, 16) : null,
      title: b.title,
      kind: bookingGroup(b.type) === "transport" ? "transport" : "activity",
      address: b.address || b.fromPlace,
      bookingId: b.id,
    })
    if (saved) toast({ title: "Ajouté à l'itinéraire" })
  }

  return (
    <div className={cn("min-w-0 space-y-2 rounded-xl border bg-card p-3", b.status === "cancelled" && "opacity-60")}>
      <div className="flex items-start gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium", b.status === "cancelled" && "line-through")}>{b.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {labelOf(BOOKING_TYPES, b.type)}
            {b.provider ? ` · ${b.provider}` : ""}
          </p>
        </div>
        <Select value={b.status} onValueChange={(status) => updateItem("bookings", b.id, { status })} disabled={!!offlineSince}>
          <SelectTrigger size="sm" className="h-7 w-auto border-0 px-0 shadow-none dark:bg-transparent [&>svg]:hidden" aria-label="État">
            <StatusBadge status={b.status} label={labelOf(BOOKING_STATUSES, b.status)} />
          </SelectTrigger>
          <SelectContent align="end">
            {BOOKING_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ActionsMenu label={`Actions pour ${b.title}`}>
          <DropdownMenuItem onClick={onEdit} disabled={!!offlineSince}>
            <Pencil className="size-4" />
            Modifier
          </DropdownMenuItem>
          {b.startAt && !inItinerary && (
            <DropdownMenuItem onClick={addToItinerary} disabled={!!offlineSince}>
              <CalendarPlus className="size-4" />
              Ajouter à l&apos;itinéraire
            </DropdownMenuItem>
          )}
          {b.url && (
            <DropdownMenuItem asChild>
              <a href={b.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Ouvrir la confirmation
              </a>
            </DropdownMenuItem>
          )}
        </ActionsMenu>
        {!offlineSince && (
          <DeleteButton
            label="Supprimer la réservation"
            onDelete={() => removeItem("bookings", b.id).then(() => undefined)}
            confirm={{ title: `Supprimer « ${b.title} » ?`, description: "Ses documents seront supprimés aussi.", destructive: true }}
          />
        )}
      </div>

      {(b.startAt || b.endAt) && (
        <p className="flex flex-wrap items-center gap-1 text-sm">
          {b.startAt && <span>{formatDateTime(b.startAt)}</span>}
          {b.endAt && (
            <>
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <span>{b.endAt.slice(0, 10) === b.startAt?.slice(0, 10) ? b.endAt.slice(11, 16) : formatDateTime(b.endAt)}</span>
            </>
          )}
        </p>
      )}
      {(b.fromPlace || b.toPlace) && (
        <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {b.fromPlace}
          {b.fromPlace && b.toPlace && <ArrowRight className="size-3.5" />}
          {b.toPlace}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {b.reference && <CopyText text={b.reference} />}
        {b.cost != null && (
          <span className="tabular-nums">
            {formatMoney(b.cost, trip.currency)} <span className={b.paid ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>· {b.paid ? "payé" : "non payé"}</span>
          </span>
        )}
      </div>
      {(b.address || b.phone || b.url) && (
        <div className="flex flex-wrap gap-2">
          {b.address && (
            <Button variant="outline" size="sm" asChild>
              <a href={directionsUrl({ lat: null, lng: null, address: b.address })} target="_blank" rel="noopener noreferrer">
                <MapPin className="size-4" />
                <span className="max-w-48 truncate">{b.address}</span>
              </a>
            </Button>
          )}
          {b.phone && (
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${b.phone.replace(/\s/g, "")}`}>
                <Phone className="size-4" />
                {b.phone}
              </a>
            </Button>
          )}
          {b.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={b.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Confirmation
              </a>
            </Button>
          )}
        </div>
      )}
      {b.notes && <p className="whitespace-pre-line text-xs text-muted-foreground">{b.notes}</p>}
      <TripFiles itemId={b.id} compact />
    </div>
  )
}

// ─── Formulaire ──────────────────────────────────────────────────────────────

export function BookingDialog({ booking, onClose }: { booking: TripBooking | null; onClose: () => void }) {
  const trip = useTrip()
  const { addItem, updateItem } = useTravel()
  const [form, setForm] = useState({
    type: booking?.type ?? "flight",
    status: booking?.status ?? "todo",
    title: booking?.title ?? "",
    provider: booking?.provider ?? "",
    reference: booking?.reference ?? "",
    startAt: booking?.startAt ?? "",
    endAt: booking?.endAt ?? "",
    fromPlace: booking?.fromPlace ?? "",
    toPlace: booking?.toPlace ?? "",
    address: booking?.address ?? "",
    url: booking?.url ?? "",
    phone: booking?.phone ?? "",
    cost: booking?.cost != null ? String(booking.cost).replace(".", ",") : "",
    paid: booking?.paid ?? false,
    notes: booking?.notes ?? "",
  })
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const transport = bookingGroup(form.type) === "transport" || form.type === "transfer"

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v]))
    const saved = booking ? await updateItem("bookings", booking.id, payload) : await addItem("bookings", payload)
    setSaving(false)
    if (saved) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{booking ? "Modifier la réservation" : "Nouvelle réservation"}</DialogTitle>
          <DialogDescription>Les horaires sont ceux du lieu (heure locale).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type} onValueChange={(type) => set({ type })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="État">
            <Select value={form.status} onValueChange={(status) => set({ status })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Intitulé" htmlFor="bk-title" className="col-span-2">
            <Input id="bk-title" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={transport ? "Vol Paris → Lisbonne" : "Hôtel Alfama"} autoFocus />
          </Field>
          <Field label="Compagnie / prestataire" htmlFor="bk-provider">
            <Input id="bk-provider" value={form.provider} onChange={(e) => set({ provider: e.target.value })} />
          </Field>
          <Field label="N° de réservation" htmlFor="bk-ref">
            <Input id="bk-ref" value={form.reference} onChange={(e) => set({ reference: e.target.value })} className="font-mono" />
          </Field>
          <Field label={transport ? "Départ" : "Début / arrivée"} htmlFor="bk-start">
            <Input id="bk-start" type="datetime-local" value={form.startAt} onChange={(e) => set({ startAt: e.target.value })} min={`${trip.startDate}T00:00`} />
          </Field>
          <Field label={transport ? "Arrivée" : "Fin / départ"} htmlFor="bk-end">
            <Input id="bk-end" type="datetime-local" value={form.endAt} onChange={(e) => set({ endAt: e.target.value })} min={form.startAt || undefined} />
          </Field>
          {transport && (
            <>
              <Field label="De" htmlFor="bk-from">
                <Input id="bk-from" value={form.fromPlace} onChange={(e) => set({ fromPlace: e.target.value })} placeholder="Gare, aéroport…" />
              </Field>
              <Field label="À" htmlFor="bk-to">
                <Input id="bk-to" value={form.toPlace} onChange={(e) => set({ toPlace: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Adresse" htmlFor="bk-address" className="col-span-2">
            <Input id="bk-address" value={form.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="Lien de confirmation" htmlFor="bk-url" className="col-span-2">
            <Input id="bk-url" type="url" value={form.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Téléphone" htmlFor="bk-phone">
            <Input id="bk-phone" type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label={`Coût (${trip.currency})`} htmlFor="bk-cost">
            <Input id="bk-cost" inputMode="decimal" value={form.cost} onChange={(e) => set({ cost: e.target.value })} />
          </Field>
          <label className="col-span-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            Déjà payé
            <Switch checked={form.paid} onCheckedChange={(paid) => set({ paid })} />
          </label>
          <Field label="Notes" htmlFor="bk-notes" className="col-span-2">
            <Textarea id="bk-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Siège, bagages, conditions d'annulation…" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {booking ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
