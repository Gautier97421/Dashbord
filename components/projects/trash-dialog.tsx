"use client"

import { useCallback, useEffect, useState } from "react"
import { FolderOpen, ListTodo, Loader2, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useApp } from "@/lib/store-api"
import { DeleteButton } from "@/components/delete-button"
import { useConfirm } from "@/components/confirm-provider"
import { timeAgo } from "./activity-panel"

interface TrashData {
  projects: { id: string; title: string; deletedAt: string; subprojects: number; tasks: number }[]
  tasks: { id: string; title: string; deletedAt: string }[]
  retentionDays: number
}

const daysLeft = (deletedAt: string, retention: number) =>
  Math.max(0, retention - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86_400_000))

export function TrashDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { refresh } = useApp()
  const confirm = useConfirm()
  const { toast } = useToast()
  const [data, setData] = useState<TrashData | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trash")
      if (res.ok) setData(await res.json())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const act = async (action: "restore" | "delete", type: "project" | "task", id: string, title: string) => {
    setBusy(`${type}:${id}`)
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, type, id }),
      })
      if (!res.ok) throw new Error()
      await load()
      if (action === "restore") {
        await refresh()
        toast({ title: "Restauré", description: title })
      }
    } catch {
      toast({ title: "Action impossible", description: "Réessaie dans un instant.", variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const empty = async () => {
    const ok = await confirm({
      title: "Vider la corbeille ?",
      description: "Tout son contenu sera supprimé définitivement.",
      confirmLabel: "Vider la corbeille",
    })
    if (!ok) return
    setBusy("all")
    await fetch("/api/trash", { method: "DELETE" }).catch(() => {})
    await load()
    setBusy(null)
  }

  const count = (data?.projects.length || 0) + (data?.tasks.length || 0)

  const row = (type: "project" | "task", id: string, title: string, deletedAt: string, detail?: string) => (
    <li key={`${type}:${id}`} className="flex items-center gap-2 rounded-lg border p-2">
      {type === "project" ? <FolderOpen className="size-4 shrink-0 text-primary" /> : <ListTodo className="size-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          Supprimé {timeAgo(deletedAt)}
          {detail && ` · ${detail}`} · encore {daysLeft(deletedAt, data?.retentionDays || 30)} j
        </p>
      </div>
      {busy === `${type}:${id}` ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Button variant="outline" size="sm" onClick={() => act("restore", type, id, title)}>
            <Undo2 className="size-4" />
            <span className="hidden sm:inline">Restaurer</span>
          </Button>
          <DeleteButton
            label="Supprimer définitivement"
            onDelete={() => act("delete", type, id, title)}
            confirm={{ title: `Supprimer définitivement « ${title} » ?`, description: "Cette action est irréversible.", confirmLabel: "Supprimer définitivement" }}
          />
        </>
      )}
    </li>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[94vw] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Corbeille</DialogTitle>
          <DialogDescription>
            Les éléments supprimés sont gardés {data?.retentionDays || 30} jours. Restaurer un projet ramène aussi ses sous-projets et ses tâches.
          </DialogDescription>
        </DialogHeader>
        {data === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : count === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">La corbeille est vide</p>
        ) : (
          <div className="space-y-4">
            {data.projects.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projets</h3>
                <ul className="space-y-1.5">
                  {data.projects.map((p) =>
                    row(
                      "project",
                      p.id,
                      p.title,
                      p.deletedAt,
                      [p.subprojects && `${p.subprojects} sous-projet${p.subprojects > 1 ? "s" : ""}`, p.tasks && `${p.tasks} tâche${p.tasks > 1 ? "s" : ""}`].filter(Boolean).join(", ") || undefined
                    )
                  )}
                </ul>
              </section>
            )}
            {data.tasks.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tâches</h3>
                <ul className="space-y-1.5">{data.tasks.map((t) => row("task", t.id, t.title, t.deletedAt))}</ul>
              </section>
            )}
            <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={empty} disabled={busy === "all"}>
              {busy === "all" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Vider la corbeille
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
