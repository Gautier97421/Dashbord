"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  BadgeCheck,
  Car,
  CloudDownload,
  CloudOff,
  CreditCard,
  FileText,
  HeartPulse,
  IdCard,
  Library,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  ShieldCheck,
  Stamp,
  X,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DeleteButton } from "@/components/delete-button"
import { useConfirm } from "@/components/confirm-provider"
import { cn } from "@/lib/utils"
import { dropDocOffline, keepDocsOffline } from "@/lib/travel/offline"
import { DOC_CATEGORIES, documentValidity, formatDay, labelOf, type Trip, type TravelDocument, type TripAttachment } from "@/lib/travel/shared"
import { send, useTravel, useTrip } from "./context"
import { TripFiles, fileUrl, invalidateOfflineDocs, useOfflineDocs } from "./files"
import { CopyText, Empty, Field, Section } from "./ui"

export const DOC_ICONS: Record<string, LucideIcon> = {
  passport: BadgeCheck,
  identity: IdCard,
  visa: Stamp,
  insurance: ShieldCheck,
  health: HeartPulse,
  driving: Car,
  card: CreditCard,
  other: FileText,
}

type LibraryDoc = TravelDocument & { links: { tripId: string; shared: boolean }[] }

function ValidityBadge({ doc, trip }: { doc: Pick<TravelDocument, "expiresAt" | "category">; trip?: Trip }) {
  const { today } = useTravel()
  if (!doc.expiresAt) return null
  const v = documentValidity(doc, trip, today)
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        !v ? "bg-muted text-muted-foreground" : v.level === "expired" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      )}
    >
      {v ? `${v.label} · ` : "Valide jusqu'au "}
      {formatDay(doc.expiresAt, true)}
    </span>
  )
}

/** Fichiers d'un document de la bibliothèque (scan, photo, PDF). */
function DocFiles({ doc, editable, onChange }: { doc: TravelDocument; editable: boolean; onChange: () => void }) {
  const { fail, offlineSince } = useTravel()
  const askConfirm = useConfirm()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const offline = useOfflineDocs()

  const upload = async (list: FileList | null) => {
    if (!list?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(list).slice(0, 10)) {
        const form = new FormData()
        form.append("file", file)
        form.append("travelDocId", doc.id)
        const res = await fetch("/api/attachments", { method: "POST", body: form })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Envoi impossible")
      }
      onChange()
    } catch (e) {
      fail(e)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const remove = async (file: TripAttachment) => {
    if (!(await askConfirm({ title: `Supprimer « ${file.name} » ?`, confirmLabel: "Supprimer", destructive: true }))) return
    const res = await fetch(fileUrl(file.id), { method: "DELETE" })
    if (!res.ok) return fail(new Error("Suppression impossible"))
    await dropDocOffline(file.id)
    invalidateOfflineDocs()
    onChange()
  }

  const toggleOffline = async (file: TripAttachment) => {
    if (offline.has(file.id)) await dropDocOffline(file.id)
    else await keepDocsOffline([file.id])
    invalidateOfflineDocs()
  }

  return (
    <div className="space-y-1">
      {doc.files.map((f) => (
        <div key={f.id} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
            {f.name}
          </a>
          <button
            type="button"
            onClick={() => toggleOffline(f)}
            className={cn("shrink-0 rounded p-0.5", offline.has(f.id) ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground")}
            title={offline.has(f.id) ? "Disponible hors connexion (cliquer pour retirer)" : "Garder sur cet appareil pour le hors connexion"}
          >
            {offline.has(f.id) ? <CloudOff className="size-4" /> : <CloudDownload className="size-4" />}
          </button>
          {editable && !offlineSince && (
            <button type="button" onClick={() => remove(f)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive" aria-label={`Supprimer ${f.name}`}>
              <X className="size-4" />
            </button>
          )}
        </div>
      ))}
      {editable && !offlineSince && (
        <>
          <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files)} />
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            Joindre un scan
          </Button>
        </>
      )}
    </div>
  )
}

export function DocumentsView() {
  const trip = useTrip()
  const { offlineSince, setTrip, fail } = useTravel()
  const others = trip.documents.filter((d) => !d.mine)
  const mineHere = trip.documents.filter((d) => d.mine)
  const hasOthers = trip.members.length > 0 || !trip.mine

  const toggleShareAll = async (shareDocs: boolean) => {
    try {
      const { trip: next } = await send<{ trip: Trip }>("PUT", "/api/trips/share-docs", { tripId: trip.id, shareDocs })
      setTrip(next)
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <Section title="Pour ce voyage" icon={<FileText className="size-4" />}>
          {hasOthers && (
            <label className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-2.5 text-sm">
              <span>
                <span className="block font-medium">Montrer mes documents aux membres</span>
                <span className="block text-xs text-muted-foreground">Sinon, seuls l&apos;itinéraire, les réservations, le budget et les préparatifs sont partagés.</span>
              </span>
              <Switch checked={trip.shareMyDocs} disabled={!!offlineSince} onCheckedChange={toggleShareAll} />
            </label>
          )}
          {mineHere.length === 0 && others.length === 0 ? (
            <p className="text-sm text-muted-foreground">Active « Utiliser pour ce voyage » sur un document de ta bibliothèque pour l&apos;avoir ici et dans le mode voyage.</p>
          ) : (
            <ul className="space-y-2">
              {[...mineHere, ...others].map((d) => {
                const Icon = DOC_ICONS[d.category] ?? FileText
                return (
                  <li key={`${d.ownerId}:${d.documentId}`} className="space-y-1.5 rounded-lg border p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title}</span>
                      <ValidityBadge doc={d} trip={trip} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {labelOf(DOC_CATEGORIES, d.category)}
                      {d.holder ? ` · ${d.holder}` : ""}
                      {d.mine ? (hasOthers ? (d.shared ? " · visible par les membres" : " · privé") : "") : ` · partagé par ${d.ownerName}`}
                    </p>
                    {d.number && <CopyText text={d.number} />}
                    {d.files.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {d.files.map((f) => (
                          <a key={f.id} href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted">
                            <FileText className="size-3 shrink-0" />
                            <span className="truncate">{f.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section title="Fichiers du voyage" icon={<Paperclip className="size-4" />}>
          <p className="text-xs text-muted-foreground">
            Attestations, plans, guides…{hasOthers ? " visibles par tous les membres." : ""} Les billets se joignent à leur réservation.
          </p>
          <TripFiles />
        </Section>
      </div>

      <LibrarySection trip={trip} />
    </div>
  )
}

/**
 * Bibliothèque personnelle : documents enregistrés une fois et réutilisés d'un voyage à l'autre.
 * Avec un voyage : interrupteurs pour l'utiliser dans ce voyage et le montrer aux membres.
 */
export function LibrarySection({ trip }: { trip: Trip | null }) {
  const { offlineSince, setTrip, fail, reload } = useTravel()
  const [library, setLibrary] = useState<LibraryDoc[] | null>(null)
  const [editing, setEditing] = useState<LibraryDoc | "new" | null>(null)

  const loadLibrary = useCallback(() => {
    send<{ documents: LibraryDoc[] }>("GET", "/api/travel-documents")
      .then((d) => setLibrary(d.documents))
      .catch(() => setLibrary((prev) => prev ?? []))
  }, [])
  useEffect(loadLibrary, [loadLibrary])

  // Les fichiers et liens changent aussi les voyages (documents affichés dans le voyage et le mode voyage)
  const refresh = () => {
    loadLibrary()
    reload()
  }

  const linkWrite = async (method: string, body: Record<string, unknown> | null, query?: string) => {
    try {
      const { trip: next } = await send<{ trip: Trip }>(method, `/api/trips/documents${query ?? ""}`, body ?? undefined)
      setTrip(next)
      loadLibrary()
    } catch (e) {
      fail(e)
    }
  }

  const hasOthers = !!trip && (trip.members.length > 0 || !trip.mine)

  return (
    <Section
      title="Ma bibliothèque"
      icon={<Library className="size-4" />}
      actions={
        <Button size="sm" onClick={() => setEditing("new")} disabled={!!offlineSince}>
          <Plus className="size-4" />
          Ajouter un document
        </Button>
      }
    >
      <p className="text-xs text-muted-foreground">
        Tes documents importants, enregistrés une fois et réutilisés pour chaque voyage. Ils restent privés, sauf si tu choisis de les montrer aux membres d&apos;un voyage.
      </p>
      {library === null ? (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : library.length === 0 ? (
        <Empty>{offlineSince ? "Bibliothèque indisponible hors connexion." : "Passeport, carte d'identité, assurance, permis, carnet de vaccination…"}</Empty>
      ) : (
        <ul className="grid gap-2 @6xl/main:grid-cols-2">
          {library.map((doc) => {
            const Icon = DOC_ICONS[doc.category] ?? FileText
            const link = trip ? doc.links.find((l) => l.tripId === trip.id) : undefined
            return (
              <li key={doc.id} className="space-y-2 rounded-lg border p-2.5">
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {labelOf(DOC_CATEGORIES, doc.category)}
                      {doc.holder ? ` · ${doc.holder}` : ""}
                      {doc.links.length ? ` · ${doc.links.length} voyage${doc.links.length > 1 ? "s" : ""}` : ""}
                    </p>
                  </div>
                  {!offlineSince && (
                    <>
                      <button type="button" onClick={() => setEditing(doc)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Modifier ${doc.title}`}>
                        <Pencil className="size-4" />
                      </button>
                      <DeleteButton
                        label="Supprimer le document"
                        onDelete={async () => {
                          try {
                            await send("DELETE", `/api/travel-documents?id=${doc.id}`)
                            refresh()
                          } catch (e) {
                            fail(e)
                          }
                        }}
                        confirm={{ title: `Supprimer « ${doc.title} » ?`, description: "Il sera retiré de tous les voyages, avec ses fichiers.", destructive: true }}
                      />
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {doc.number && <CopyText text={doc.number} />}
                  <ValidityBadge doc={doc} trip={link && trip ? trip : undefined} />
                </div>
                {doc.notes && <p className="whitespace-pre-line text-xs text-muted-foreground">{doc.notes}</p>}
                <DocFiles doc={doc} editable onChange={refresh} />
                {trip && (
                  <div className="space-y-1.5 border-t pt-2">
                    <label className="flex items-center justify-between gap-2 text-sm">
                      Utiliser pour ce voyage
                      <Switch
                        checked={!!link}
                        disabled={!!offlineSince}
                        onCheckedChange={(on) =>
                          on ? linkWrite("POST", { tripId: trip.id, documentId: doc.id }) : linkWrite("DELETE", null, `?tripId=${trip.id}&documentId=${doc.id}`)
                        }
                      />
                    </label>
                    {link && hasOthers && !trip.shareMyDocs && (
                      <label className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                        Montrer celui-ci aux membres
                        <Switch checked={link.shared} disabled={!!offlineSince} onCheckedChange={(shared) => linkWrite("PUT", { tripId: trip.id, documentId: doc.id, shared })} />
                      </label>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <DocumentDialog
          doc={editing === "new" ? null : editing}
          inTrip={!!trip}
          onClose={() => setEditing(null)}
          onSaved={async (saved, created) => {
            setEditing(null)
            // Un document créé depuis un voyage y est utilisé directement
            if (created && trip) await linkWrite("POST", { tripId: trip.id, documentId: saved.id })
            refresh()
          }}
        />
      )}
    </Section>
  )
}

function DocumentDialog({ doc, inTrip, onClose, onSaved }: { doc: LibraryDoc | null; inTrip: boolean; onClose: () => void; onSaved: (doc: LibraryDoc, created: boolean) => void }) {
  const { fail } = useTravel()
  const [form, setForm] = useState({
    title: doc?.title ?? "",
    category: doc?.category ?? "passport",
    number: doc?.number ?? "",
    holder: doc?.holder ?? "",
    issuedAt: doc?.issuedAt ?? "",
    expiresAt: doc?.expiresAt ?? "",
    notes: doc?.notes ?? "",
  })
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]))
    try {
      const { document } = doc
        ? await send<{ document: LibraryDoc }>("PUT", "/api/travel-documents", { id: doc.id, ...payload })
        : await send<{ document: LibraryDoc }>("POST", "/api/travel-documents", payload)
      onSaved(document, !doc)
    } catch (e) {
      fail(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{doc ? "Modifier le document" : "Nouveau document"}</DialogTitle>
          <DialogDescription>{doc ? "Les changements valent pour tous les voyages qui l'utilisent." : inTrip ? "Il sera ajouté à ta bibliothèque et utilisé pour ce voyage. Joins le scan ensuite." : "Il sera ajouté à ta bibliothèque. Joins le scan ensuite."}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.category} onValueChange={(category) => set({ category, title: form.title || labelOf(DOC_CATEGORIES, category) })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Titulaire" htmlFor="doc-holder">
            <Input id="doc-holder" value={form.holder} onChange={(e) => set({ holder: e.target.value })} />
          </Field>
          <Field label="Nom du document" htmlFor="doc-title" className="col-span-2">
            <Input id="doc-title" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Passeport, Assurance voyage…" autoFocus />
          </Field>
          <Field label="Numéro" htmlFor="doc-number" className="col-span-2">
            <Input id="doc-number" value={form.number} onChange={(e) => set({ number: e.target.value })} className="font-mono" placeholder="N° de passeport, de contrat…" />
          </Field>
          <Field label="Délivré le" htmlFor="doc-issued">
            <Input id="doc-issued" type="date" value={form.issuedAt} onChange={(e) => set({ issuedAt: e.target.value })} />
          </Field>
          <Field label="Expire le" htmlFor="doc-expires">
            <Input id="doc-expires" type="date" value={form.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} />
          </Field>
          <Field label="Notes" htmlFor="doc-notes" className="col-span-2">
            <Textarea id="doc-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Numéro d'assistance, garanties…" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {doc ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
