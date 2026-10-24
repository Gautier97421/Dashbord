"use client"

import { useMemo, useState } from "react"
import { Archive, ArchiveRestore, Ban, CalendarDays, Loader2, LogOut, MapPin, Pencil, Plus, RotateCcw, Share2, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DeleteButton } from "@/components/delete-button"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/confirm-provider"
import { Avatar, OPEN_SOCIAL_EVENT, useFriends } from "@/components/social-button"
import { CURRENCIES, budgetStats, countdown, formatMoney, formatRange, newId, tripPhase, type Traveler, type Trip, type TripStop } from "@/lib/travel/shared"
import { StopsEditor } from "./stops-editor"
import { send, useTravel } from "./context"
import { ActionsMenu, Bar, Empty, Field, PhaseBadge } from "./ui"

type Filter = "all" | "upcoming" | "ongoing" | "past" | "archived"

export function TripsView({ onCreate }: { onCreate: () => void }) {
  const { trips, today, openTab, saveTrip, removeTrip, fail, offlineSince } = useTravel()
  const askConfirm = useConfirm()
  const [filter, setFilter] = useState<Filter>("all")
  const [editing, setEditing] = useState<Trip | null>(null)

  const list = useMemo(() => {
    const shown = trips.filter((t) => {
      if (filter === "archived") return t.archived
      if (t.archived) return false
      if (filter === "all") return true
      return tripPhase(t, today) === filter
    })
    // À venir et en cours d'abord (du plus proche au plus lointain), puis les passés du plus récent au plus ancien
    return shown.sort((a, b) => {
      const pa = tripPhase(a, today) === "past" || a.cancelled
      const pb = tripPhase(b, today) === "past" || b.cancelled
      if (pa !== pb) return pa ? 1 : -1
      return pa ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate)
    })
  }, [trips, filter, today])

  const leave = async (trip: Trip) => {
    if (!(await askConfirm({ title: `Quitter « ${trip.title} » ?`, description: `${trip.ownerName} pourra te le repartager.`, confirmLabel: "Quitter", destructive: true }))) return
    try {
      await send("DELETE", `/api/trips/share?tripId=${trip.id}`)
      removeTrip(trip.id)
    } catch (e) {
      fail(e)
    }
  }

  const remove = async (trip: Trip) => {
    try {
      await send("DELETE", `/api/trips?id=${trip.id}`)
      removeTrip(trip.id)
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} aria-label="Voyages affichés">
          <ToggleGroupItem value="all">Tous</ToggleGroupItem>
          <ToggleGroupItem value="upcoming">À venir</ToggleGroupItem>
          <ToggleGroupItem value="ongoing">En cours</ToggleGroupItem>
          <ToggleGroupItem value="past">Passés</ToggleGroupItem>
          <ToggleGroupItem value="archived">Archives</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {list.length === 0 ? (
        <Empty>
          {filter === "archived" ? "Aucun voyage archivé." : "Aucun voyage ici."}{" "}
          {filter !== "archived" && (
            <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={onCreate}>
              Créer un voyage
            </button>
          )}
        </Empty>
      ) : (
        <div className="grid gap-3 @3xl/main:grid-cols-2 @6xl/main:grid-cols-3">
          {list.map((trip) => {
            const phase = tripPhase(trip, today)
            const stats = budgetStats(trip)
            const prepDone = trip.checklist.filter((c) => c.done).length
            return (
              <div key={trip.id} className="min-w-0 space-y-2 rounded-xl border bg-card p-3">
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => openTab("itinerary", trip.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold">{trip.title}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      {trip.destination}
                    </p>
                  </button>
                  <PhaseBadge phase={phase} />
                  <ActionsMenu label={`Actions pour ${trip.title}`}>
                    <DropdownMenuItem onClick={() => setEditing(trip)} disabled={!!offlineSince}>
                      <Pencil className="size-4" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openTab("itinerary", trip.id)}>
                      <CalendarDays className="size-4" />
                      Itinéraire
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {trip.mine ? (
                      <>
                        <DropdownMenuItem onClick={() => setEditing(trip)} disabled={!!offlineSince}>
                          <Share2 className="size-4" />
                          Partager avec des amis
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => saveTrip(trip.id, { cancelled: !trip.cancelled })} disabled={!!offlineSince}>
                          {trip.cancelled ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
                          {trip.cancelled ? "Rétablir le voyage" : "Marquer annulé"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => saveTrip(trip.id, { archived: !trip.archived })} disabled={!!offlineSince}>
                          {trip.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                          {trip.archived ? "Désarchiver" : "Archiver"}
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onClick={() => leave(trip)} disabled={!!offlineSince} className="text-destructive focus:text-destructive">
                        <LogOut className="size-4" />
                        Quitter le voyage
                      </DropdownMenuItem>
                    )}
                  </ActionsMenu>
                  {trip.mine && (
                    <DeleteButton
                      label="Supprimer le voyage"
                      onDelete={() => remove(trip)}
                      confirm={{
                        title: `Supprimer « ${trip.title} » ?`,
                        description: `Itinéraire, réservations, dépenses, préparatifs, carnet et documents seront supprimés${trip.members.length ? ", pour tous les membres" : ""}.`,
                        destructive: true,
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {formatRange(trip.startDate, trip.endDate)}
                  </span>
                  <span className="font-medium text-foreground">{countdown(trip, today)}</span>
                  {trip.travelers.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" />
                      {trip.travelers.length}
                    </span>
                  )}
                </div>
                {trip.members.length > 0 && <SharedWith trip={trip} />}
                {stats.budget != null && (
                  <div className="space-y-1">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">Budget</span>
                      <span className="tabular-nums">
                        {formatMoney(stats.committed, trip.currency)} / {formatMoney(stats.budget, trip.currency)}
                      </span>
                    </div>
                    <Bar value={stats.budget ? stats.committed / stats.budget : 0} />
                  </div>
                )}
                {trip.checklist.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">Préparatifs</span>
                      <span className="tabular-nums">
                        {prepDone} / {trip.checklist.length}
                      </span>
                    </div>
                    <Bar value={prepDone / trip.checklist.length} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && <TripDialog trip={editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />}
    </div>
  )
}

// ─── Création / modification ─────────────────────────────────────────────────

/** Avatars des personnes qui partagent le voyage. */
export function SharedWith({ trip }: { trip: Trip }) {
  const people = [{ userId: trip.ownerId, name: trip.ownerName }, ...trip.members]
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {people.slice(0, 5).map((p) => (
          <Avatar key={p.userId} name={p.name} className="size-6 border-2 border-card text-[10px]" />
        ))}
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {trip.mine ? `Partagé avec ${trip.members.map((m) => m.name).join(", ")}` : `Partagé par ${trip.ownerName}`}
      </span>
    </div>
  )
}

export function TripDialog({ trip, onClose, onSaved }: { trip: Trip | null; onClose: () => void; onSaved: (trip: Trip) => void }) {
  const { toast } = useToast()
  const { today, saveTrip, setTrip } = useTravel()
  const friends = useFriends()
  const canShare = !trip || trip.mine
  const [shareWith, setShareWith] = useState<string[]>(trip?.members.map((m) => m.userId) ?? [])
  const [form, setForm] = useState({
    title: trip?.title ?? "",
    destination: trip?.destination ?? "",
    startDate: trip?.startDate ?? today,
    endDate: trip?.endDate ?? today,
    abroad: trip?.abroad ?? false,
    currency: trip?.currency ?? "EUR",
    budget: trip?.budget != null ? String(trip.budget).replace(".", ",") : "",
    notes: trip?.notes ?? "",
  })
  const [travelers, setTravelers] = useState<Traveler[]>(trip?.travelers ?? [])
  const [stops, setStops] = useState<TripStop[]>(trip?.stops ?? [])
  // Montrer aussi mes documents (passeport, assurance…) aux membres ; sinon seuls itinéraire, budget, etc. sont partagés
  const [shareDocs, setShareDocs] = useState(trip?.shareMyDocs ?? false)
  const hasOthers = trip ? trip.members.length > 0 || !trip.mine : shareWith.length > 0
  const [newTraveler, setNewTraveler] = useState("")
  const [withChecklist, setWithChecklist] = useState(true)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  // Partager avec un ami l'ajoute aussi aux voyageurs (pour répartir les dépenses)
  const toggleShare = (friend: { id: string; name: string }, on: boolean) => {
    setShareWith((list) => (on ? [...list, friend.id] : list.filter((id) => id !== friend.id)))
    const travelerId = `u:${friend.id}`
    if (on && !travelers.some((t) => t.id === travelerId)) setTravelers((list) => [...list, { id: travelerId, name: friend.name }])
    if (!on) setTravelers((list) => list.filter((t) => t.id !== travelerId))
  }

  const addTraveler = () => {
    const name = newTraveler.trim()
    if (!name || travelers.length >= 20) return
    setTravelers((list) => [...list, { id: newId(), name }])
    setNewTraveler("")
  }

  // Destination affichée : celle saisie, sinon les étapes (« Rome → Florence → Venise »)
  const destination = form.destination.trim() || stops.map((s) => s.name).join(" → ").slice(0, 160)
  const valid = form.title.trim() && destination && form.startDate && form.endDate && form.endDate >= form.startDate

  const save = async () => {
    if (!valid) return
    setSaving(true)
    const pending = newTraveler.trim() ? [...travelers, { id: newId(), name: newTraveler.trim() }] : travelers
    const payload = { ...form, destination, budget: form.budget.trim() || null, notes: form.notes.trim() || null, travelers: pending, stops }
    try {
      if (trip) {
        let saved = await saveTrip(trip.id, payload)
        const before = trip.members.map((m) => m.userId).sort().join()
        if (saved && trip.mine && before !== [...shareWith].sort().join()) {
          saved = (await send<{ trip: Trip }>("PUT", "/api/trips/share", { tripId: trip.id, userIds: shareWith })).trip
          setTrip(saved)
        }
        if (saved && shareDocs !== trip.shareMyDocs) {
          saved = (await send<{ trip: Trip }>("PUT", "/api/trips/share-docs", { tripId: trip.id, shareDocs })).trip
          setTrip(saved)
        }
        if (saved) onSaved(saved)
      } else {
        const { trip: created } = await send<{ trip: Trip }>("POST", "/api/trips", { ...payload, withChecklist, shareWith, shareDocs })
        onSaved(created)
      }
    } catch (e) {
      toast({ title: "Enregistrement impossible", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{trip ? "Modifier le voyage" : "Nouveau voyage"}</DialogTitle>
          <DialogDescription>Destination, dates, budget et voyageurs.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom du voyage" htmlFor="trip-title" className="col-span-2">
            <Input id="trip-title" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Été au Portugal" autoFocus />
          </Field>
          <Field label="Destinations" className="col-span-2">
            <StopsEditor stops={stops} onChange={setStops} minDate={form.startDate} maxDate={form.endDate} />
          </Field>
          <Field label="Résumé de la destination (facultatif)" htmlFor="trip-dest" className="col-span-2">
            <Input id="trip-dest" value={form.destination} onChange={(e) => set({ destination: e.target.value })} placeholder={stops.length ? stops.map((s) => s.name).join(" → ") : "Italie, Portugal…"} />
          </Field>
          <Field label="Départ" htmlFor="trip-start">
            <Input
              id="trip-start"
              type="date"
              value={form.startDate}
              onChange={(e) => set({ startDate: e.target.value, endDate: form.endDate < e.target.value ? e.target.value : form.endDate })}
            />
          </Field>
          <Field label="Retour" htmlFor="trip-end">
            <Input id="trip-end" type="date" min={form.startDate} value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} />
          </Field>
          <Field label="Budget prévu" htmlFor="trip-budget">
            <Input id="trip-budget" inputMode="decimal" value={form.budget} onChange={(e) => set({ budget: e.target.value })} placeholder="Facultatif" />
          </Field>
          <Field label="Devise du budget">
            <Select value={form.currency} onValueChange={(v) => set({ currency: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <label className="col-span-2 flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">Voyage à l&apos;étranger</span>
              <span className="block text-xs text-muted-foreground">Ajoute passeport, visa, santé, eSIM et adaptateur aux préparatifs</span>
            </span>
            <Switch checked={form.abroad} onCheckedChange={(v) => set({ abroad: v })} />
          </label>

          <Field label="Voyageurs" className="col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {travelers.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-sm">
                  {t.name}
                  <button type="button" onClick={() => setTravelers((list) => list.filter((x) => x.id !== t.id))} aria-label={`Retirer ${t.name}`}>
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTraveler}
                onChange={(e) => setNewTraveler(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTraveler())}
                placeholder="Prénom (pour partager les dépenses)"
              />
              <Button type="button" variant="outline" onClick={addTraveler} disabled={!newTraveler.trim()}>
                <Plus className="size-4" />
                Ajouter
              </Button>
            </div>
          </Field>

          {canShare && (
            <Field label="Partager le voyage" className="col-span-2">
              {friends === null ? (
                <p className="text-xs text-muted-foreground">Chargement des amis…</p>
              ) : friends.length === 0 && !shareWith.length ? (
                <p className="text-xs text-muted-foreground">
                  Ajoute d&apos;abord des amis avec le bouton{" "}
                  <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => window.dispatchEvent(new Event(OPEN_SOCIAL_EVENT))}>
                    Social
                  </button>{" "}
                  (à gauche de la cloche) : vous pourrez préparer le voyage ensemble, chacun sur son app.
                </p>
              ) : (
                <div className="space-y-1.5 rounded-lg border p-2">
                  {[...(friends ?? []), ...(trip?.members ?? []).filter((m) => !friends?.some((f) => f.id === m.userId)).map((m) => ({ id: m.userId, name: m.name, username: null as string | null }))].map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={shareWith.includes(f.id)} onCheckedChange={(v) => toggleShare(f, v === true)} />
                      <Avatar name={f.name} className="size-6 text-[10px]" />
                      <span className="min-w-0 flex-1 truncate">
                        {f.name}
                        {f.username && <span className="text-muted-foreground"> @{f.username}</span>}
                      </span>
                    </label>
                  ))}
                  <p className="text-xs text-muted-foreground">Ils verront et modifieront le programme, les réservations, le budget et les préparatifs.</p>
                </div>
              )}
            </Field>
          )}
          {hasOthers && (
            <label className="col-span-2 flex items-center justify-between gap-3 rounded-lg border p-3">
              <span>
                <span className="block text-sm font-medium">Partager aussi mes documents</span>
                <span className="block text-xs text-muted-foreground">
                  Passeport, assurance… que tu utilises pour ce voyage. Désactivé : seuls l&apos;itinéraire, les réservations, le budget et les préparatifs sont partagés.
                </span>
              </span>
              <Switch checked={shareDocs} onCheckedChange={setShareDocs} />
            </label>
          )}

          <Field label="Notes" htmlFor="trip-notes" className="col-span-2">
            <Textarea id="trip-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>

          {!trip && (
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <Checkbox checked={withChecklist} onCheckedChange={(v) => setWithChecklist(v === true)} />
              Ajouter la checklist de départ (datée à partir du départ)
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !valid}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {trip ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
