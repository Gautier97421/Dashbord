"use client"

import { useState } from "react"
import { BookOpen, CheckCircle2, Loader2, MapPin, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DeleteButton } from "@/components/delete-button"
import { PLACE_KINDS, formatDay, labelOf, type TripJournalEntry } from "@/lib/travel/shared"
import { useTravel, useTrip } from "./context"
import { TripFiles } from "./files"
import { ActionsMenu, Empty, Field, Section } from "./ui"

const NONE = "none"

export function JournalView() {
  const trip = useTrip()
  const { removeItem, offlineSince } = useTravel()
  const [editing, setEditing] = useState<TripJournalEntry | "new" | null>(null)
  const visited = trip.places.filter((p) => p.status === "visited")
  const photos = trip.attachments.filter((a) => a.mimeType.startsWith("image/") && trip.journal.some((j) => j.id === a.tripItemId)).length

  return (
    <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm text-muted-foreground">
            {trip.journal.length} page{trip.journal.length > 1 ? "s" : ""} · {photos} photo{photos > 1 ? "s" : ""}
          </p>
          <Button size="sm" onClick={() => setEditing("new")} disabled={!!offlineSince}>
            <Plus className="size-4" />
            Écrire une page
          </Button>
        </div>
        {trip.journal.length === 0 ? (
          <Empty>Souvenirs, impressions, anecdotes et photos : ton journal de voyage, jour après jour.</Empty>
        ) : (
          trip.journal.map((entry) => {
            const place = trip.places.find((p) => p.id === entry.placeId)
            return (
              <article key={entry.id} className="space-y-2 rounded-xl border bg-card p-3 sm:p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{formatDay(entry.date, true)}</p>
                    {entry.title && <h3 className="font-semibold">{entry.title}</h3>}
                    {place && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {place.name}
                      </p>
                    )}
                  </div>
                  <ActionsMenu label="Actions pour la page">
                    <DropdownMenuItem onClick={() => setEditing(entry)} disabled={!!offlineSince}>
                      <Pencil className="size-4" />
                      Modifier
                    </DropdownMenuItem>
                  </ActionsMenu>
                  {!offlineSince && (
                    <DeleteButton label="Supprimer la page" onDelete={() => removeItem("journal", entry.id).then(() => undefined)} confirm={{ title: "Supprimer cette page du carnet ?", description: "Ses photos seront supprimées aussi.", destructive: true }} />
                  )}
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed">{entry.text}</p>
                <TripFiles itemId={entry.id} images compact />
              </article>
            )
          })
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <Section title="Lieux visités" icon={<CheckCircle2 className="size-4" />}>
          {visited.length === 0 ? (
            <p className="text-xs text-muted-foreground">Marque les lieux « Visité » dans Itinéraire → Carte et lieux.</p>
          ) : (
            <ul className="space-y-1">
              {visited.map((p) => (
                <li key={p.id} className="text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground"> · {labelOf(PLACE_KINDS, p.kind)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        {trip.notes && (
          <Section title="Notes du voyage" icon={<BookOpen className="size-4" />}>
            <p className="whitespace-pre-line text-sm">{trip.notes}</p>
          </Section>
        )}
      </div>

      {editing && <EntryDialog entry={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EntryDialog({ entry, onClose }: { entry: TripJournalEntry | null; onClose: () => void }) {
  const trip = useTrip()
  const { addItem, updateItem, today } = useTravel()
  const defaultDay = today < trip.startDate ? trip.startDate : today > trip.endDate ? trip.endDate : today
  const [form, setForm] = useState({ date: entry?.date ?? defaultDay, title: entry?.title ?? "", text: entry?.text ?? "", placeId: entry?.placeId ?? NONE })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.text.trim()) return
    setSaving(true)
    const payload = { ...form, title: form.title.trim() || null, text: form.text.trim(), placeId: form.placeId === NONE ? null : form.placeId }
    const saved = entry ? await updateItem("journal", entry.id, payload) : await addItem("journal", payload)
    setSaving(false)
    if (saved) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Modifier la page" : "Nouvelle page du carnet"}</DialogTitle>
          <DialogDescription>{entry ? "Ajoute aussi des photos à cette page." : "Les photos s'ajoutent une fois la page enregistrée."}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="jr-date">
            <Input id="jr-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          {trip.places.length > 0 && (
            <Field label="Lieu">
              <Select value={form.placeId} onValueChange={(placeId) => setForm({ ...form, placeId })}>
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
          <Field label="Titre" htmlFor="jr-title" className="col-span-2">
            <Input id="jr-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Facultatif" />
          </Field>
          <Field label="Récit" htmlFor="jr-text" className="col-span-2">
            <Textarea id="jr-text" rows={6} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Ce qu'on a vu, mangé, ressenti…" autoFocus />
          </Field>
          {entry && (
            <Field label="Photos" className="col-span-2">
              <TripFiles itemId={entry.id} images compact />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !form.text.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {entry ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
