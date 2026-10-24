"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, FileText, ImageIcon, Loader2, Paperclip, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeleteButton } from "@/components/delete-button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface AttachmentItem {
  id: string
  name: string
  mimeType: string
  size: number
  createdAt: string
}

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} o` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`

export function AttachmentsPanel({ projectId, taskId }: { projectId?: string; taskId?: string }) {
  const [files, setFiles] = useState<AttachmentItem[] | null>(null)
  const [uploading, setUploading] = useState(0)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const query = taskId ? `taskId=${taskId}` : `projectId=${projectId}`

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/attachments?${query}`)
      if (res.ok) setFiles(await res.json())
    } catch {
      /* ignore */
    }
  }, [query])

  useEffect(() => {
    load()
  }, [load])

  const upload = async (list: FileList | File[]) => {
    const selected = Array.from(list)
    if (!selected.length) return
    setUploading((n) => n + selected.length)
    for (const file of selected) {
      const form = new FormData()
      form.append("file", file)
      if (taskId) form.append("taskId", taskId)
      else if (projectId) form.append("projectId", projectId)
      try {
        const res = await fetch("/api/attachments", { method: "POST", body: form })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error)
        }
      } catch (error: any) {
        toast({ title: `« ${file.name} » non envoyé`, description: error?.message || "Réessaie dans un instant.", variant: "destructive" })
      } finally {
        setUploading((n) => n - 1)
      }
    }
    await load()
  }

  const remove = async (file: AttachmentItem) => {
    setFiles((prev) => prev?.filter((f) => f.id !== file.id) ?? null)
    await fetch(`/api/attachments/${file.id}`, { method: "DELETE" }).catch(() => {})
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          upload(e.dataTransfer.files)
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground transition-colors",
          dragging && "border-primary bg-primary/5"
        )}
      >
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading > 0}>
          {uploading > 0 ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading > 0 ? "Envoi…" : "Ajouter des fichiers"}
        </Button>
        <span className="text-xs">ou glisse-les ici · 10 Mo maximum par fichier</span>
      </div>

      {files && files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file) => {
            const Icon = file.mimeType.startsWith("image/") ? ImageIcon : file.mimeType === "application/pdf" ? FileText : Paperclip
            return (
              <li key={file.id} className="flex items-center gap-2 rounded-lg border p-2">
                <Icon className="size-4 shrink-0 text-primary" />
                <a href={`/api/attachments/${file.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 hover:underline">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </p>
                </a>
                <Button asChild variant="ghost" size="icon" className="size-8 shrink-0">
                  <a href={`/api/attachments/${file.id}?download=1`} aria-label={`Télécharger ${file.name}`} title="Télécharger">
                    <Download className="size-4" />
                  </a>
                </Button>
                <DeleteButton
                  label="Supprimer le fichier"
                  onDelete={() => remove(file)}
                  confirm={{ title: `Supprimer « ${file.name} » ?`, description: "Le fichier est supprimé définitivement." }}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
