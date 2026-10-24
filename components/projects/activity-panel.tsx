"use client"

import { useCallback, useEffect, useState } from "react"
import { History, Loader2, MessageSquare, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeleteButton } from "@/components/delete-button"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export interface ActivityItem {
  id: string
  kind: "comment" | "event"
  message: string
  createdAt: string
  projectId: string | null
  taskId: string | null
  projectTitle: string | null
  taskTitle: string | null
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `il y a ${d} j`
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: d > 300 ? "numeric" : undefined })
}

type Filter = "all" | "comment" | "event"

interface ActivityPanelProps {
  // Activité de ces projets (le projet et ses sous-projets) ou d'une seule tâche
  projectIds?: string[]
  taskId?: string
  // Recharge quand cette valeur change (ex. date de dernière modification de la tâche)
  version?: string
  // Affiche la tâche concernée devant chaque entrée (vue projet)
  showTask?: boolean
}

export function ActivityPanel({ projectIds, taskId, version, showTask = false }: ActivityPanelProps) {
  const [items, setItems] = useState<ActivityItem[] | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const { toast } = useToast()
  const projectKey = projectIds?.join(",") || ""

  const load = useCallback(async () => {
    const query = taskId ? `taskId=${encodeURIComponent(taskId)}` : `projectIds=${encodeURIComponent(projectKey)}`
    try {
      const res = await fetch(`/api/project-activity?${query}`)
      if (res.ok) setItems(await res.json())
    } catch {
      /* hors ligne : on garde l'affichage */
    }
  }, [taskId, projectKey])

  useEffect(() => {
    load()
  }, [load, version])

  const send = async () => {
    const message = draft.trim()
    if (!message || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/project-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskId ? { taskId, message } : { projectId: projectIds?.[0], message }),
      })
      if (!res.ok) throw new Error()
      setDraft("")
      await load()
    } catch {
      toast({ title: "Commentaire non envoyé", description: "Réessaie dans un instant.", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const remove = async (id: string) => {
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? null)
    await fetch(`/api/project-activity?id=${id}`, { method: "DELETE" }).catch(() => {})
  }

  const visible = (items || []).filter((i) => filter === "all" || i.kind === filter)

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          placeholder="Ajouter un commentaire…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              send()
            }
          }}
          rows={2}
          className="min-h-16 resize-y"
        />
        <div className="flex items-center justify-between gap-2">
          <ToggleGroup type="single" size="sm" variant="outline" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} aria-label="Filtrer l'activité">
            <ToggleGroupItem value="all">Tout</ToggleGroupItem>
            <ToggleGroupItem value="comment" aria-label="Commentaires">
              <MessageSquare className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="event" aria-label="Historique">
              <History className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button size="sm" onClick={send} disabled={!draft.trim() || sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Envoyer
          </Button>
        </div>
      </div>

      {items === null ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Chargement…</p>
      ) : visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {filter === "comment" ? "Aucun commentaire" : filter === "event" ? "Aucune modification enregistrée" : "Rien pour l'instant"}
        </p>
      ) : (
        <ol className="space-y-2">
          {visible.map((item) =>
            item.kind === "comment" ? (
              <li key={item.id} className="group rounded-lg border bg-muted/30 p-2.5">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageSquare className="size-3.5 text-primary" />
                  <span>{timeAgo(item.createdAt)}</span>
                  {showTask && item.taskTitle && <span className="truncate">· {item.taskTitle}</span>}
                  <DeleteButton
                    label="Supprimer le commentaire"
                    onDelete={() => remove(item.id)}
                    confirm={{ title: "Supprimer ce commentaire ?", description: item.message.slice(0, 140) }}
                    className="-my-1 ml-auto"
                  />
                </div>
                <p className="whitespace-pre-wrap text-sm">{item.message}</p>
              </li>
            ) : (
              <li key={item.id} className={cn("flex items-start gap-2 px-1 text-xs text-muted-foreground")}>
                <History className="mt-0.5 size-3.5 shrink-0" />
                <span className="flex-1">{item.message}</span>
                <span className="shrink-0 whitespace-nowrap">{timeAgo(item.createdAt)}</span>
              </li>
            )
          )}
        </ol>
      )}
    </div>
  )
}
