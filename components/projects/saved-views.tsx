"use client"

import { useCallback, useEffect, useState } from "react"
import { Bookmark, BookmarkPlus, Check, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"

interface SavedView<F> {
  id: string
  name: string
  filters: F
}

/**
 * Vues enregistrées (filtres + tri) de la liste des projets ou de "Mes tâches", synchronisées entre
 * appareils. `builtins` : vues fournies, toujours proposées en premier.
 */
export function SavedViewsMenu<F extends object>({
  scope,
  current,
  onApply,
  builtins = [],
  isActive,
}: {
  scope: "projects" | "tasks"
  current: F
  onApply: (filters: F) => void
  builtins?: { name: string; filters: F }[]
  isActive?: (filters: F) => boolean
}) {
  const [views, setViews] = useState<SavedView<F>[]>([])
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/saved-views?scope=${scope}`)
      if (res.ok) setViews(await res.json())
    } catch {
      /* ignore */
    }
  }, [scope])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    const name = window.prompt("Nom de la vue (ex : Urgences, Cette semaine)")?.trim()
    if (!name) return
    const res = await fetch("/api/saved-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, name, filters: current }),
    }).catch(() => null)
    if (res?.ok) {
      toast({ title: "Vue enregistrée", description: name })
      load()
    } else {
      toast({ title: "Vue non enregistrée", variant: "destructive" })
    }
  }

  const remove = async (id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id))
    await fetch(`/api/saved-views?id=${id}`, { method: "DELETE" }).catch(() => {})
  }

  const same = (filters: F) => (isActive ? isActive(filters) : JSON.stringify(filters) === JSON.stringify(current))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Bookmark className="size-4" />
          <span className="hidden sm:inline">Vues</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {builtins.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Vues prêtes</DropdownMenuLabel>
            {builtins.map((v) => (
              <DropdownMenuItem key={v.name} onClick={() => onApply(v.filters)}>
                <Check className={same(v.filters) ? "size-4" : "size-4 opacity-0"} />
                {v.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-xs text-muted-foreground">Mes vues</DropdownMenuLabel>
        {views.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Aucune vue enregistrée</p>}
        {views.map((v) => (
          <DropdownMenuItem key={v.id} onClick={() => onApply(v.filters)} className="group">
            <Check className={same(v.filters) ? "size-4" : "size-4 opacity-0"} />
            <span className="flex-1 truncate">{v.name}</span>
            <button
              type="button"
              className="text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                remove(v.id)
              }}
              aria-label={`Supprimer la vue ${v.name}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={save}>
          <BookmarkPlus className="size-4" />
          Enregistrer la vue actuelle…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
