"use client"

import { useState } from "react"
import { ExternalLink, FileText, Loader2, Pencil, Phone, Plus, ShieldCheck, Sparkles, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DeleteButton } from "@/components/delete-button"
import { cn } from "@/lib/utils"
import {
  CHECKLIST_CATEGORIES,
  CONTACT_KINDS,
  OFFICIAL_LINKS,
  defaultChecklist,
  formatDay,
  labelOf,
  newId,
  type TripChecklistItem,
  type TripContact,
} from "@/lib/travel/shared"
import { useTravel, useTrip } from "./context"
import { Bar, Field, Section } from "./ui"

const NONE = "none"

export function PrepView() {
  const trip = useTrip()
  const { addItem, offlineSince, openTab } = useTravel()
  const [editing, setEditing] = useState<TripChecklistItem | null>(null)
  const [seeding, setSeeding] = useState(false)
  const done = trip.checklist.filter((c) => c.done).length

  const seed = async () => {
    setSeeding(true)
    const existing = new Set(trip.checklist.map((c) => c.title.toLowerCase()))
    let order = trip.checklist.length
    for (const item of defaultChecklist(trip.startDate, trip.abroad)) {
      if (existing.has(item.title.toLowerCase())) continue
      if (!(await addItem("checklist", { ...item, order: order++ }))) break
    }
    setSeeding(false)
  }

  return (
    <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <span className="font-semibold tabular-nums">
                {done} / {trip.checklist.length}
              </span>{" "}
              <span className="text-muted-foreground">préparatifs faits</span>
            </p>
            {!offlineSince && (
              <Button variant="outline" size="sm" onClick={seed} disabled={seeding}>
                {seeding ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {trip.checklist.length ? "Compléter avec la checklist type" : "Ajouter la checklist type"}
              </Button>
            )}
          </div>
          {trip.checklist.length > 0 && <Bar value={done / trip.checklist.length} />}
        </div>

        {CHECKLIST_CATEGORIES.map((cat) => (
          <ChecklistGroup key={cat.value} category={cat.value} label={cat.label} onEdit={setEditing} />
        ))}
      </div>

      <div className="min-w-0 space-y-4">
        <Section title="Formalités, santé et sécurité" icon={<ShieldCheck className="size-4" />}>
          <p className="text-xs text-muted-foreground">
            {trip.abroad
              ? "Les exigences (passeport, visa, vaccins) dépendent de ta nationalité et de la destination : vérifie-les auprès des sources officielles."
              : "Pour un voyage à l'étranger, active « Voyage à l'étranger » dans les réglages du voyage : passeport, visa et santé seront ajoutés."}
          </p>
          <div className="flex flex-col gap-1.5">
            {OFFICIAL_LINKS.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ExternalLink className="size-3.5 shrink-0" />
                {link.name}
              </a>
            ))}
          </div>
        </Section>
        <ContactsSection />
        <Section title="Documents du voyage" icon={<FileText className="size-4" />}>
          <p className="text-xs text-muted-foreground">
            {trip.documents.filter((d) => d.mine).length} document{trip.documents.filter((d) => d.mine).length > 1 ? "s" : ""} de ta bibliothèque utilisé
            {trip.documents.filter((d) => d.mine).length > 1 ? "s" : ""} pour ce voyage. Passeport, assurance, permis… se gèrent dans l&apos;onglet Documents.
          </p>
          <Button variant="outline" size="sm" onClick={() => openTab("documents")}>
            Ouvrir les documents
          </Button>
        </Section>
      </div>

      {editing && <ChecklistItemDialog item={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ChecklistGroup({ category, label, onEdit }: { category: string; label: string; onEdit: (item: TripChecklistItem) => void }) {
  const trip = useTrip()
  const { addItem, updateItem, removeItem, today, offlineSince } = useTravel()
  const [title, setTitle] = useState("")
  const [adding, setAdding] = useState(false)
  const items = trip.checklist.filter((c) => c.category === category)
  const nameOf = (id: string | null) => trip.travelers.find((t) => t.id === id)?.name

  const add = async () => {
    if (!title.trim()) return
    setAdding(true)
    const saved = await addItem("checklist", { category, title: title.trim(), order: trip.checklist.length })
    setAdding(false)
    if (saved) setTitle("")
  }

  return (
    <div className="space-y-1.5 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {items.filter((i) => i.done).length}/{items.length}
          </span>
        )}
      </div>
      {items.length > 0 && (
        <ul className="space-y-0.5">
          {items.map((item) => {
            const overdue = !item.done && item.dueDate && item.dueDate < today
            return (
              <li key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
                <Checkbox checked={item.done} onCheckedChange={(v) => updateItem("checklist", item.id, { done: v === true })} disabled={!!offlineSince} aria-label={item.title} />
                <span className={cn("min-w-0 flex-1 truncate text-sm", item.done && "text-muted-foreground line-through")}>{item.title}</span>
                {nameOf(item.assignee) && (
                  <span className="hidden shrink-0 items-center gap-0.5 text-xs text-muted-foreground @md:inline-flex">
                    <UserRound className="size-3" />
                    {nameOf(item.assignee)}
                  </span>
                )}
                {item.dueDate && !item.done && (
                  <span className={cn("shrink-0 text-xs tabular-nums", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>{formatDay(item.dueDate)}</span>
                )}
                {!offlineSince && (
                  <>
                    <button type="button" onClick={() => onEdit(item)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Modifier ${item.title}`}>
                      <Pencil className="size-3.5" />
                    </button>
                    <DeleteButton label="Supprimer" confirm={false} onDelete={() => removeItem("checklist", item.id).then(() => undefined)} />
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!offlineSince && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ajouter…" className="h-8" />
          <Button type="submit" variant="outline" size="icon" className="size-8 shrink-0" disabled={adding || !title.trim()} aria-label="Ajouter">
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </form>
      )}
    </div>
  )
}

function ChecklistItemDialog({ item, onClose }: { item: TripChecklistItem; onClose: () => void }) {
  const trip = useTrip()
  const { updateItem } = useTravel()
  const [form, setForm] = useState({ title: item.title, category: item.category, dueDate: item.dueDate ?? "", assignee: item.assignee ?? NONE })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const saved = await updateItem("checklist", item.id, { ...form, dueDate: form.dueDate || null, assignee: form.assignee === NONE ? null : form.assignee })
    setSaving(false)
    if (saved) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Préparatif</DialogTitle>
          <DialogDescription>Échéance et personne responsable.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Intitulé" htmlFor="ck-title" className="col-span-2">
            <Input id="ck-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Catégorie">
            <Select value={form.category} onValueChange={(category) => setForm({ ...form, category })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHECKLIST_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="À faire avant le" htmlFor="ck-due">
            <Input id="ck-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
          {trip.travelers.length > 0 && (
            <Field label="Qui s'en charge" className="col-span-2">
              <Select value={form.assignee} onValueChange={(assignee) => setForm({ ...form, assignee })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Personne en particulier</SelectItem>
                  {trip.travelers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Contacts utiles ─────────────────────────────────────────────────────────

export function ContactsSection({ readOnly = false }: { readOnly?: boolean }) {
  const trip = useTrip()
  const { saveTrip, offlineSince } = useTravel()
  const [editing, setEditing] = useState<TripContact | "new" | null>(null)
  const locked = readOnly || !!offlineSince

  const remove = (id: string) => saveTrip(trip.id, { contacts: trip.contacts.filter((c) => c.id !== id) }).then(() => undefined)

  return (
    <Section
      title="Contacts utiles"
      icon={<Phone className="size-4" />}
      actions={
        !locked && (
          <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        )
      }
    >
      {trip.contacts.length === 0 ? (
        <p className="text-xs text-muted-foreground">Urgences, consulat, assurance, hébergement… En Europe, le 112 joint les secours.</p>
      ) : (
        <ul className="space-y-2">
          {trip.contacts.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {labelOf(CONTACT_KINDS, c.kind)}
                  {c.note ? ` · ${c.note}` : ""}
                </p>
              </div>
              {c.phone && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${c.phone.replace(/\s/g, "")}`}>
                    <Phone className="size-4" />
                    <span className="hidden @md/main:inline">{c.phone}</span>
                  </a>
                </Button>
              )}
              {!locked && (
                <>
                  <button type="button" onClick={() => setEditing(c)} className="mt-1 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Modifier ${c.name}`}>
                    <Pencil className="size-3.5" />
                  </button>
                  <DeleteButton label="Supprimer le contact" confirm={false} onDelete={() => remove(c.id)} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <ContactDialog contact={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Section>
  )
}

function ContactDialog({ contact, onClose }: { contact: TripContact | null; onClose: () => void }) {
  const trip = useTrip()
  const { saveTrip } = useTravel()
  const [form, setForm] = useState({ name: contact?.name ?? "", kind: contact?.kind ?? "emergency", phone: contact?.phone ?? "", note: contact?.note ?? "" })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const next: TripContact = { id: contact?.id ?? newId(), name: form.name.trim(), kind: form.kind, phone: form.phone.trim() || null, note: form.note.trim() || null }
    const contacts = contact ? trip.contacts.map((c) => (c.id === contact.id ? next : c)) : [...trip.contacts, next]
    const saved = await saveTrip(trip.id, { contacts })
    setSaving(false)
    if (saved) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? "Modifier le contact" : "Nouveau contact"}</DialogTitle>
          <DialogDescription>Accessible aussi dans le mode voyage, même sans réseau.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom" htmlFor="ct-name" className="col-span-2">
            <Input id="ct-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Consulat de France à Lisbonne" autoFocus />
          </Field>
          <Field label="Type">
            <Select value={form.kind} onValueChange={(kind) => setForm({ ...form, kind })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Téléphone" htmlFor="ct-phone">
            <Input id="ct-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Note" htmlFor="ct-note" className="col-span-2">
            <Input id="ct-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="N° de contrat, horaires…" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

