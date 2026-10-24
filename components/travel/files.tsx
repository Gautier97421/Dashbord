"use client"

import { useEffect, useRef, useState } from "react"
import { CloudDownload, CloudOff, FileText, Image as ImageIcon, Loader2, Paperclip, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useConfirm } from "@/components/confirm-provider"
import { cn } from "@/lib/utils"
import { dropDocOffline, keepDocsOffline, offlineDocIds } from "@/lib/travel/offline"
import type { TripAttachment } from "@/lib/travel/shared"
import { useTravel, useTrip } from "./context"

const IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp"

export const fileUrl = (id: string) => `/api/attachments/${id}`

// Documents gardés sur l'appareil, partagés entre toutes les listes de la page
let offlineCache: Promise<Set<string>> | null = null
const listeners = new Set<() => void>()
export function useOfflineDocs() {
  const [ids, setIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    const refresh = () => (offlineCache ??= offlineDocIds()).then(setIds)
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [])
  return ids
}
export function invalidateOfflineDocs() {
  offlineCache = null
  listeners.forEach((l) => l())
}

/**
 * Documents d'un voyage (billets, confirmations, justificatifs, photos du carnet) ; `itemId` limite
 * aux documents d'une réservation, d'une dépense ou d'une page du carnet.
 */
export function TripFiles({ itemId, images = false, compact = false }: { itemId?: string | null; images?: boolean; compact?: boolean }) {
  const trip = useTrip()
  const { setTrip, fail, offlineSince } = useTravel()
  const askConfirm = useConfirm()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const offline = useOfflineDocs()
  const files = trip.attachments.filter((a) => (itemId === undefined ? !a.tripItemId : a.tripItemId === itemId))

  const upload = async (list: FileList | null) => {
    if (!list?.length) return
    setUploading(true)
    let current = trip
    try {
      for (const file of Array.from(list).slice(0, 10)) {
        const form = new FormData()
        form.append("file", file)
        form.append("tripId", trip.id)
        if (itemId) form.append("tripItemId", itemId)
        const res = await fetch("/api/attachments", { method: "POST", body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Envoi impossible")
        current = { ...current, attachments: [{ ...data, createdAt: String(data.createdAt) } as TripAttachment, ...current.attachments] }
        setTrip(current)
      }
    } catch (e) {
      fail(e)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const remove = async (file: TripAttachment) => {
    if (!(await askConfirm({ title: `Supprimer « ${file.name} » ?`, confirmLabel: "Supprimer", destructive: true }))) return
    try {
      const res = await fetch(fileUrl(file.id), { method: "DELETE" })
      if (!res.ok) throw new Error("Suppression impossible")
      await dropDocOffline(file.id)
      invalidateOfflineDocs()
      setTrip({ ...trip, attachments: trip.attachments.filter((a) => a.id !== file.id) })
    } catch (e) {
      fail(e)
    }
  }

  const toggleOffline = async (file: TripAttachment) => {
    if (offline.has(file.id)) await dropDocOffline(file.id)
    else await keepDocsOffline([file.id])
    invalidateOfflineDocs()
  }

  const isImage = (f: TripAttachment) => f.mimeType.startsWith("image/")

  return (
    <div className="space-y-2">
      {images && files.some(isImage) && (
        <div className="grid grid-cols-3 gap-1.5 @2xl/main:grid-cols-4">
          {files.filter(isImage).map((f) => (
            <div key={f.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
              <a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(f.id)} alt={f.name} loading="lazy" className="size-full object-cover" />
              </a>
              {!offlineSince && (
                <button
                  type="button"
                  onClick={() => remove(f)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                  aria-label={`Supprimer ${f.name}`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {files.filter((f) => !images || !isImage(f)).length > 0 && (
        <ul className="space-y-1">
          {files
            .filter((f) => !images || !isImage(f))
            .map((f) => (
              <li key={f.id} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                {isImage(f) ? <ImageIcon className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
                <a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                  {f.name}
                </a>
                <button
                  type="button"
                  onClick={() => toggleOffline(f)}
                  className={cn("shrink-0 rounded p-0.5", offline.has(f.id) ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground")}
                  title={offline.has(f.id) ? "Disponible hors connexion (cliquer pour retirer)" : "Garder sur cet appareil pour le hors connexion"}
                  aria-label={offline.has(f.id) ? "Retirer du hors connexion" : "Garder hors connexion"}
                >
                  {offline.has(f.id) ? <CloudOff className="size-4" /> : <CloudDownload className="size-4" />}
                </button>
                {!offlineSince && (
                  <button type="button" onClick={() => remove(f)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive" aria-label={`Supprimer ${f.name}`}>
                    <X className="size-4" />
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}

      {!offlineSince && (
        <>
          <input ref={inputRef} type="file" multiple accept={images ? IMAGE_TYPES : undefined} className="hidden" onChange={(e) => upload(e.target.files)} />
          <Button type="button" variant="outline" size="sm" className={cn(compact && "h-7 px-2 text-xs")} onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : images ? <ImageIcon className="size-4" /> : <Paperclip className="size-4" />}
            {images ? "Ajouter des photos" : "Joindre un document"}
          </Button>
        </>
      )}
    </div>
  )
}
