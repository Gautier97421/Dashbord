"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Car,
  Coffee,
  Copy,
  ExternalLink,
  Footprints,
  Landmark,
  LocateFixed,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  Route,
  Sparkles,
  Star,
  Ticket,
  Umbrella,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DeleteButton } from "@/components/delete-button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  ACTIVITY_KINDS,
  PLACE_KINDS,
  PLACE_STATUSES,
  directionsUrl,
  distanceKm,
  formatDay,
  formatKm,
  labelOf,
  parseCoordinates,
  scheduleConflicts,
  sortActivities,
  tripDays,
  type Trip,
  type TripActivity,
  type TripPlace,
} from "@/lib/travel/shared"
import { send, useTravel, useTrip } from "./context"
import { KIND_COLORS, TripMap, type MapPoint, type PickedPoint } from "./trip-map"
import { ActionsMenu, CopyText, Empty, Field, StatusBadge } from "./ui"

const NONE = "none"
const ALL = "all"

export const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  activity: Sparkles,
  visit: Landmark,
  restaurant: UtensilsCrossed,
  poi: Star,
  transport: Car,
  rest: Coffee,
  other: MapPin,
}

/** Programme de la journée en texte (copier, partager). */
function programText(trip: Trip) {
  const lines = [`${trip.title} — ${trip.destination}`]
  for (const day of tripDays(trip)) {
    const list = sortActivities(trip.activities.filter((a) => a.day === day))
    if (!list.length) continue
    lines.push("", formatDay(day, true))
    for (const a of list) {
      const time = a.startTime ? `${a.startTime}${a.endTime ? `–${a.endTime}` : ""} ` : ""
      const place = trip.places.find((p) => p.id === a.placeId)
      const where = a.address || place?.address || place?.name
      lines.push(`• ${time}${a.title}${where ? ` (${where})` : ""}`)
      if (a.rainPlan) lines.push(`  Si pluie : ${a.rainPlan}`)
    }
  }
  return lines.join("\n")
}

export function ItineraryView() {
  const [view, setView] = useState<"program" | "map">("program")
  return (
    <div className="space-y-4">
      <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v as "program" | "map")} aria-label="Affichage">
        <ToggleGroupItem value="program">
          <Route className="size-4" />
          Programme
        </ToggleGroupItem>
        <ToggleGroupItem value="map">
          <MapPin className="size-4" />
          Carte et lieux
        </ToggleGroupItem>
      </ToggleGroup>
      {view === "program" ? <ProgramView /> : <PlacesView />}
    </div>
  )
}

// ─── Programme jour par jour ─────────────────────────────────────────────────

function ProgramView() {
  const trip = useTrip()
  const { today, offlineSince } = useTravel()
  const { toast } = useToast()
  const days = tripDays(trip)
  const [day, setDay] = useState(() => (days.includes(today) ? today : days[0]))
  const [editing, setEditing] = useState<TripActivity | "new" | null>(null)
  const conflicts = useMemo(() => scheduleConflicts(trip.activities), [trip.activities])
  const list = sortActivities(trip.activities.filter((a) => a.day === day))
  const placeOf = (id: string | null) => trip.places.find((p) => p.id === id)
  const located = list.map((a) => placeOf(a.placeId)).filter((p): p is TripPlace & { lat: number; lng: number } => p?.lat != null && p?.lng != null)

  const copy = async () => {
    const text = programText(trip)
    try {
      if (navigator.share && window.matchMedia("(hover: none)").matches) await navigator.share({ title: trip.title, text })
      else {
        await navigator.clipboard.writeText(text)
        toast({ title: "Programme copié", description: "Colle-le dans un message pour le partager." })
      }
    } catch {
      // partage annulé
    }
  }

  return (
    <div className="space-y-3">
      {/* Journées */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {days.map((d, i) => {
          const count = trip.activities.filter((a) => a.day === d).length
          const warn = trip.activities.some((a) => a.day === d && conflicts.has(a.id))
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={cn(
                "relative flex min-w-16 shrink-0 flex-col items-center rounded-lg border px-2 py-1.5 text-xs transition-colors",
                d === day ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                d === today && d !== day && "border-primary"
              )}
            >
              <span className="font-semibold">J{i + 1}</span>
              <span className={cn("whitespace-nowrap", d === day ? "text-primary-foreground/80" : "text-muted-foreground")}>{formatDay(d)}</span>
              {count > 0 && <span className="mt-0.5 tabular-nums">{count}</span>}
              {warn && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-500" />}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-sm font-semibold">
          {formatDay(day, true)}
          {day === today && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">Aujourd&apos;hui</span>}
        </h2>
        {located.length > 0 && (
          <Button variant="outline" size="sm" asChild>
            <a href={directionsUrl(located[located.length - 1], located.slice(0, -1))} target="_blank" rel="noopener noreferrer">
              <Navigation className="size-4" />
              Itinéraire du jour
            </a>
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy className="size-4" />
          Partager le programme
        </Button>
        <Button size="sm" onClick={() => setEditing("new")} disabled={!!offlineSince}>
          <Plus className="size-4" />
          Ajouter une étape
        </Button>
      </div>

      {list.length === 0 ? (
        <Empty>Rien de prévu ce jour-là. Ajoute des visites, restaurants, trajets ou temps libres.</Empty>
      ) : (
        <ol className="space-y-0">
          {list.map((a, i) => {
            const prevPlace = i > 0 ? placeOf(list[i - 1].placeId) : undefined
            const place = placeOf(a.placeId)
            const km = prevPlace?.lat != null && prevPlace.lng != null && place?.lat != null && place.lng != null ? distanceKm(prevPlace as { lat: number; lng: number }, place as { lat: number; lng: number }) : null
            return (
              <li key={a.id}>
                {i > 0 && (a.travelMinutes || km != null) && (
                  <div className="flex items-center gap-1.5 py-1 pl-[3.25rem] text-xs text-muted-foreground">
                    <Footprints className="size-3.5" />
                    {a.travelMinutes ? `${a.travelMinutes} min de trajet` : ""}
                    {a.travelMinutes && km != null ? " · " : ""}
                    {km != null ? `${formatKm(km)} à vol d'oiseau` : ""}
                  </div>
                )}
                {i > 0 && !a.travelMinutes && km == null && <div className="h-2" />}
                <ActivityCard activity={a} place={place} warning={conflicts.get(a.id)} onEdit={() => setEditing(a)} />
              </li>
            )
          })}
        </ol>
      )}

      {editing && <ActivityDialog activity={editing === "new" ? null : editing} defaultDay={day} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ActivityCard({ activity: a, place, warning, onEdit }: { activity: TripActivity; place?: TripPlace; warning?: string; onEdit: () => void }) {
  const trip = useTrip()
  const { updateItem, removeItem, offlineSince } = useTravel()
  const Icon = ACTIVITY_ICONS[a.kind] ?? MapPin
  const booking = trip.bookings.find((b) => b.id === a.bookingId)
  const address = a.address || place?.address
  const target = place?.lat != null || address ? directionsUrl({ lat: place?.lat ?? null, lng: place?.lng ?? null, address, name: place?.name }) : null

  return (
    <div className={cn("flex gap-3 rounded-xl border bg-card p-3", a.done && "opacity-60")}>
      <div className="w-10 shrink-0 text-right text-xs tabular-nums">
        {a.startTime ? <p className="font-semibold">{a.startTime}</p> : <p className="text-muted-foreground">—</p>}
        {a.endTime && <p className="text-muted-foreground">{a.endTime}</p>}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className={cn("min-w-0 flex-1 text-sm font-medium", a.done && "line-through")}>{a.title}</p>
          <Checkbox checked={a.done} onCheckedChange={(v) => updateItem("activities", a.id, { done: v === true })} disabled={!!offlineSince} aria-label="Fait" className="mt-0.5" />
          <ActionsMenu label={`Actions pour ${a.title}`}>
            <DropdownMenuItem onClick={onEdit} disabled={!!offlineSince}>
              <Pencil className="size-4" />
              Modifier
            </DropdownMenuItem>
            {target && (
              <DropdownMenuItem asChild>
                <a href={target} target="_blank" rel="noopener noreferrer">
                  <Navigation className="size-4" />
                  Y aller
                </a>
              </DropdownMenuItem>
            )}
          </ActionsMenu>
          {!offlineSince && <DeleteButton label="Supprimer l'étape" onDelete={() => removeItem("activities", a.id).then(() => undefined)} confirm={{ title: `Supprimer « ${a.title} » ?`, destructive: true }} />}
        </div>
        {(place || address) && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {target ? (
              <a href={target} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                {[place?.name, address].filter(Boolean).join(" · ")}
              </a>
            ) : (
              <span className="truncate">{place?.name}</span>
            )}
          </p>
        )}
        {booking && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs">
            <Ticket className="size-3 text-muted-foreground" />
            <span className="truncate">{booking.title}</span>
            {booking.reference && <CopyText text={booking.reference} />}
          </p>
        )}
        {a.notes && <p className="whitespace-pre-line text-xs text-muted-foreground">{a.notes}</p>}
        {a.rainPlan && (
          <p className="flex items-start gap-1 rounded-md bg-sky-500/10 px-2 py-1 text-xs text-sky-800 dark:text-sky-300">
            <Umbrella className="mt-0.5 size-3 shrink-0" />
            <span>
              <span className="font-medium">Si pluie : </span>
              {a.rainPlan}
            </span>
          </p>
        )}
        {warning && (
          <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3 shrink-0" />
            {warning}
          </p>
        )}
      </div>
    </div>
  )
}

function ActivityDialog({ activity, defaultDay, onClose }: { activity: TripActivity | null; defaultDay: string; onClose: () => void }) {
  const trip = useTrip()
  const { addItem, updateItem } = useTravel()
  const days = tripDays(trip)
  const [form, setForm] = useState({
    day: activity?.day ?? defaultDay,
    startTime: activity?.startTime ?? "",
    endTime: activity?.endTime ?? "",
    title: activity?.title ?? "",
    kind: activity?.kind ?? "visit",
    placeId: activity?.placeId ?? NONE,
    address: activity?.address ?? "",
    travelMinutes: activity?.travelMinutes != null ? String(activity.travelMinutes) : "",
    bookingId: activity?.bookingId ?? NONE,
    notes: activity?.notes ?? "",
    rainPlan: activity?.rainPlan ?? "",
  })
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      title: form.title.trim(),
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      placeId: form.placeId === NONE ? null : form.placeId,
      bookingId: form.bookingId === NONE ? null : form.bookingId,
      address: form.address.trim() || null,
      travelMinutes: form.travelMinutes.trim() || null,
      notes: form.notes.trim() || null,
      rainPlan: form.rainPlan.trim() || null,
      ...(activity ? {} : { order: trip.activities.filter((a) => a.day === form.day).length }),
    }
    const saved = activity ? await updateItem("activities", activity.id, payload) : await addItem("activities", payload)
    setSaving(false)
    if (saved) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{activity ? "Modifier l'étape" : "Nouvelle étape"}</DialogTitle>
          <DialogDescription>Activité, visite, restaurant, trajet ou pause.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Intitulé" htmlFor="ac-title" className="col-span-2">
            <Input id="ac-title" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Visite du château" autoFocus />
          </Field>
          <Field label="Jour">
            <Select value={form.day} onValueChange={(day) => set({ day })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((d, i) => (
                  <SelectItem key={d} value={d}>
                    J{i + 1} · {formatDay(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={form.kind} onValueChange={(kind) => set({ kind })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Début" htmlFor="ac-start">
            <Input id="ac-start" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} />
          </Field>
          <Field label="Fin" htmlFor="ac-end">
            <Input id="ac-end" type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
          </Field>
          {trip.places.length > 0 && (
            <Field label="Lieu enregistré" className="col-span-2">
              <Select value={form.placeId} onValueChange={(placeId) => set({ placeId })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucun</SelectItem>
                  {trip.places.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Adresse" htmlFor="ac-address" className="col-span-2">
            <Input id="ac-address" value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Si différente du lieu enregistré" />
          </Field>
          <Field label="Trajet depuis l'étape précédente (min)" htmlFor="ac-travel">
            <Input id="ac-travel" type="number" min={0} max={1440} value={form.travelMinutes} onChange={(e) => set({ travelMinutes: e.target.value })} />
          </Field>
          {trip.bookings.length > 0 && (
            <Field label="Réservation associée">
              <Select value={form.bookingId} onValueChange={(bookingId) => set({ bookingId })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucune</SelectItem>
                  {trip.bookings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Notes" htmlFor="ac-notes" className="col-span-2">
            <Textarea id="ac-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          <Field label="Alternative en cas de pluie" htmlFor="ac-rain" className="col-span-2">
            <Textarea id="ac-rain" rows={2} value={form.rainPlan} onChange={(e) => set({ rainPlan: e.target.value })} placeholder="Musée, marché couvert…" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {activity ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Carte et lieux ──────────────────────────────────────────────────────────

const UNPLANNED = "unplanned"

function PlacesView() {
  const trip = useTrip()
  const { offlineSince, updateItem, removeItem } = useTravel()
  const days = tripDays(trip)
  const [dayFilter, setDayFilter] = useState<string>(ALL)
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<TripPlace | "new" | null>(null)
  // Point choisi sur la carte (clic, recherche, lieu utile) : formulaire pré-rempli
  const [picked, setPicked] = useState<PickedPoint | null>(null)

  const shown = trip.places.filter(
    (p) => (dayFilter === ALL || (dayFilter === UNPLANNED ? !p.day : p.day === dayFilter)) && (statusFilter === ALL || p.status === statusFilter)
  )
  // Ordre de la journée : celui de l'itinéraire, puis les autres lieux
  const dayOrder = (day: string) => {
    const ids = sortActivities(trip.activities.filter((a) => a.day === day)).map((a) => a.placeId)
    return (p: TripPlace) => {
      const i = ids.indexOf(p.id)
      return i === -1 ? 1000 : i
    }
  }
  const groups = (dayFilter === ALL ? [...days, UNPLANNED] : [dayFilter])
    .map((key) => {
      let list = shown.filter((p) => (key === UNPLANNED ? !p.day || !days.includes(p.day) : p.day === key))
      if (key !== UNPLANNED) {
        const rank = dayOrder(key)
        list = [...list].sort((a, b) => rank(a) - rank(b))
      }
      return { key, list }
    })
    .filter((g) => g.list.length)

  const points: MapPoint[] = shown
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => {
      const group = groups.find((g) => g.list.includes(p))
      const index = group && group.key !== UNPLANNED && dayFilter !== ALL ? group.list.filter((x) => x.lat != null).indexOf(p) : -1
      return { id: p.id, lat: p.lat as number, lng: p.lng as number, label: p.name, color: KIND_COLORS[p.kind] ?? KIND_COLORS.other, badge: index >= 0 ? String(index + 1) : undefined, faded: p.status === "visited" }
    })
  const routeOn = dayFilter !== ALL && dayFilter !== UNPLANNED
  const ordered = routeOn ? [...points].sort((a, b) => Number(a.badge) - Number(b.badge)) : points

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={dayFilter} onValueChange={setDayFilter}>
          <SelectTrigger size="sm" className="w-48" aria-label="Journée">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes les journées</SelectItem>
            {days.map((d, i) => (
              <SelectItem key={d} value={d}>
                J{i + 1} · {formatDay(d)}
              </SelectItem>
            ))}
            <SelectItem value={UNPLANNED}>Non planifiés</SelectItem>
          </SelectContent>
        </Select>
        <ToggleGroup type="single" variant="outline" size="sm" value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)} aria-label="État des lieux">
          <ToggleGroupItem value={ALL}>Tous</ToggleGroupItem>
          {PLACE_STATUSES.map((s) => (
            <ToggleGroupItem key={s.value} value={s.value}>
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button size="sm" className="ml-auto" onClick={() => setEditing("new")} disabled={!!offlineSince}>
          <Plus className="size-4" />
          Ajouter un lieu
        </Button>
      </div>

      <div className="grid gap-3 @5xl/main:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 @5xl/main:sticky @5xl/main:top-0 @5xl/main:self-start">
          <TripMap
            points={ordered}
            stops={trip.stops}
            route={routeOn}
            selectedId={selected}
            onSelect={setSelected}
            onAddPoint={offlineSince ? undefined : setPicked}
          />
          {!trip.stops.length && (
            <p className="mt-1.5 text-xs text-muted-foreground">Astuce : ajoute les destinations dans les réglages du voyage (« Modifier ») pour que la carte s&apos;y place directement.</p>
          )}
        </div>
        <div className="min-w-0 space-y-3 @5xl/main:max-h-[calc(100vh-14rem)] @5xl/main:overflow-y-auto @5xl/main:pr-1">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {PLACE_KINDS.map((k) => (
          <span key={k.value} className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: KIND_COLORS[k.value] }} />
            {k.label}
          </span>
        ))}
      </div>

      {groups.length === 0 ? (
        <Empty>Enregistre hébergements, restaurants, visites, gares, aéroports, parkings… depuis une adresse ou un lien Google Maps.</Empty>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="space-y-1.5">
            <h3 className="text-sm font-semibold">{g.key === UNPLANNED ? "Non planifiés" : `J${days.indexOf(g.key) + 1} · ${formatDay(g.key)}`}</h3>
            <ul className="divide-y rounded-xl border bg-card">
              {g.list.map((p, i) => {
                const prev = g.key !== UNPLANNED ? g.list.slice(0, i).reverse().find((x) => x.lat != null && x.lng != null) : undefined
                const km = prev && p.lat != null && p.lng != null ? distanceKm(prev as { lat: number; lng: number }, p as { lat: number; lng: number }) : null
                return (
                  <li key={p.id} className={cn("flex items-start gap-2 px-3 py-2", selected === p.id && "bg-primary/5")}>
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: KIND_COLORS[p.kind] ?? KIND_COLORS.other }} />
                    <button type="button" onClick={() => setSelected(p.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {labelOf(PLACE_KINDS, p.kind)}
                        {p.address ? ` · ${p.address}` : ""}
                        {km != null ? ` · ${formatKm(km)} du précédent` : ""}
                        {p.lat == null ? " · non localisé" : ""}
                      </p>
                    </button>
                    <Select value={p.status} onValueChange={(status) => updateItem("places", p.id, { status })} disabled={!!offlineSince}>
                      <SelectTrigger size="sm" className="h-7 w-auto border-0 px-0 shadow-none dark:bg-transparent [&>svg]:hidden" aria-label="État">
                        <StatusBadge status={p.status} label={labelOf(PLACE_STATUSES, p.status)} />
                      </SelectTrigger>
                      <SelectContent align="end">
                        {PLACE_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ActionsMenu label={`Actions pour ${p.name}`}>
                      {(p.lat != null || p.address) && (
                        <DropdownMenuItem asChild>
                          <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer">
                            <Navigation className="size-4" />
                            Itinéraire (navigation)
                          </a>
                        </DropdownMenuItem>
                      )}
                      {p.url && (
                        <DropdownMenuItem asChild>
                          <a href={p.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-4" />
                            Ouvrir le lien
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setEditing(p)} disabled={!!offlineSince}>
                        <Pencil className="size-4" />
                        Modifier
                      </DropdownMenuItem>
                    </ActionsMenu>
                    {!offlineSince && <DeleteButton label="Supprimer le lieu" onDelete={() => removeItem("places", p.id).then(() => undefined)} confirm={{ title: `Supprimer « ${p.name} » ?`, destructive: true }} />}
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
        </div>
      </div>

      {(editing || picked) && (
        <PlaceDialog
          place={editing && editing !== "new" ? editing : null}
          initial={picked}
          defaultDay={dayFilter !== ALL && dayFilter !== UNPLANNED ? dayFilter : null}
          onClose={() => {
            setEditing(null)
            setPicked(null)
          }}
        />
      )}
    </div>
  )
}

function PlaceDialog({ place, initial, defaultDay, onClose }: { place: TripPlace | null; initial?: PickedPoint | null; defaultDay: string | null; onClose: () => void }) {
  const trip = useTrip()
  const { addItem, updateItem } = useTravel()
  const { toast } = useToast()
  const days = tripDays(trip)
  const [form, setForm] = useState({
    name: place?.name ?? initial?.name ?? "",
    kind: place?.kind ?? initial?.kind ?? "visit",
    status: place?.status ?? "todo",
    address: place?.address ?? initial?.address ?? "",
    url: place?.url ?? initial?.url ?? "",
    day: place?.day ?? defaultDay ?? NONE,
    notes: place?.notes ?? "",
  })
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    place?.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : initial ? { lat: initial.lat, lng: initial.lng } : null
  )

  // Point cliqué sur la carte sans adresse : on cherche l'adresse de cet endroit
  useEffect(() => {
    if (place || !initial || initial.address) return
    let cancelled = false
    send<{ name: string | null; address: string | null }>("GET", `/api/trips/geocode?lat=${initial.lat}&lng=${initial.lng}`)
      .then((r) => {
        if (cancelled) return
        setForm((f) => ({ ...f, name: f.name || r.name || "", address: f.address || r.address || "" }))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [results, setResults] = useState<{ name: string; lat: number; lng: number }[]>([])
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  // Lien Google Maps / OpenStreetMap ou « lat, lng » collé : coordonnées lues directement
  const onLink = (url: string) => {
    set({ url })
    const found = parseCoordinates(url)
    if (found) setCoords(found)
  }

  const locate = async () => {
    const q = form.address.trim() || form.name.trim()
    const direct = parseCoordinates(q)
    if (direct) return setCoords(direct)
    if (q.length < 3) return
    setLocating(true)
    try {
      const data = await send<{ results: { name: string; lat: number; lng: number }[] }>("GET", `/api/trips/geocode?q=${encodeURIComponent(`${q}${form.address.trim() ? "" : `, ${trip.destination}`}`)}`)
      setResults(data.results)
      if (data.results.length === 1) setCoords(data.results[0])
      if (!data.results.length) toast({ title: "Adresse introuvable", description: "Précise l'adresse ou colle un lien Google Maps." })
    } catch (e) {
      toast({ title: "Localisation impossible", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    } finally {
      setLocating(false)
    }
  }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      name: form.name.trim(),
      address: form.address.trim() || null,
      url: form.url.trim() || null,
      day: form.day === NONE ? null : form.day,
      notes: form.notes.trim() || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    }
    const saved = place ? await updateItem("places", place.id, payload) : await addItem("places", payload)
    setSaving(false)
    if (saved) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{place ? "Modifier le lieu" : "Nouveau lieu"}</DialogTitle>
          <DialogDescription>Depuis une adresse (recherche OpenStreetMap) ou un lien Google Maps.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom" htmlFor="pl-name" className="col-span-2">
            <Input id="pl-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Tour de Belém" autoFocus />
          </Field>
          <Field label="Type">
            <Select value={form.kind} onValueChange={(kind) => set({ kind })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLACE_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
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
                {PLACE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Adresse" htmlFor="pl-address" className="col-span-2">
            <div className="flex gap-2">
              <Input id="pl-address" value={form.address} onChange={(e) => set({ address: e.target.value })} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), locate())} />
              <Button type="button" variant="outline" onClick={locate} disabled={locating || (!form.address.trim() && !form.name.trim())} className="shrink-0">
                {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
                Localiser
              </Button>
            </div>
            {results.length > 1 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border text-sm">
                {results.map((r) => (
                  <li key={`${r.lat},${r.lng}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setCoords(r)
                        setResults([])
                      }}
                      className="w-full px-2 py-1.5 text-left hover:bg-muted"
                    >
                      {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className={cn("text-xs", coords ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
              {coords ? `Localisé (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})` : "Non localisé : le lieu n'apparaîtra pas sur la carte."}
              {coords && (
                <button type="button" className="ml-2 text-muted-foreground underline" onClick={() => setCoords(null)}>
                  retirer
                </button>
              )}
            </p>
          </Field>
          <Field label="Lien (Google Maps, site, réservation…)" htmlFor="pl-url" className="col-span-2">
            <Input id="pl-url" value={form.url} onChange={(e) => onLink(e.target.value)} placeholder="https://maps.google.com/…" />
          </Field>
          <Field label="Journée">
            <Select value={form.day} onValueChange={(day) => set({ day })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Non planifié</SelectItem>
                {days.map((d, i) => (
                  <SelectItem key={d} value={d}>
                    J{i + 1} · {formatDay(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes" htmlFor="pl-notes" className="col-span-2">
            <Textarea id="pl-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Horaires, prix, conseils…" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {place ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
