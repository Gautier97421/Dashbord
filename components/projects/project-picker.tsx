"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, Check, ChevronRight, ChevronsUpDown, FolderOpen, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useApp } from "@/lib/store-api"
import { cn } from "@/lib/utils"
import { normalizeSearch } from "@/lib/projects/meta"
import type { Project } from "@/lib/types"
import { projectPath } from "./context"

interface ProjectPickerProps {
  value: string | null | undefined
  onChange: (projectId: string | null) => void
  // Choix "aucun projet" : "Aucun projet", "Tous les projets", "Aucun (projet principal)"…
  noneLabel?: string
  // Projets à ne pas proposer (ex. le projet modifié et ses sous-projets, pour un parent)
  exclude?: Set<string>
  // Projets archivés proposés aussi (par défaut : non)
  includeArchived?: boolean
  size?: "sm" | "default"
  className?: string
  id?: string
}

/**
 * Choix d'un projet niveau par niveau : d'abord les projets principaux, puis, si on veut, leurs
 * sous-projets, et ainsi de suite. Une recherche trouve directement un projet à n'importe quel niveau.
 */
export function ProjectPicker({ value, onChange, noneLabel = "Aucun projet", exclude, includeArchived = false, size = "default", className, id }: ProjectPickerProps) {
  const { state } = useApp()
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const projects = useMemo(
    () => state.projects.filter((p) => !exclude?.has(p.id) && (includeArchived || !p.completedAt || p.id === value)),
    [state.projects, exclude, includeArchived, value]
  )
  const byId = useMemo(() => new Map(state.projects.map((p) => [p.id, p])), [state.projects])
  const childrenOf = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id))
    const map = new Map<string | null, Project[]>()
    for (const p of projects) {
      const key = p.parentId && ids.has(p.parentId) ? p.parentId : null
      map.set(key, [...(map.get(key) || []), p])
    }
    for (const list of map.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title, "fr"))
    return map
  }, [projects])

  const selected = value ? byId.get(value) : undefined
  const current = level ? byId.get(level) : undefined
  const items = childrenOf.get(level) || []
  const results = useMemo(() => {
    const q = normalizeSearch(query.trim())
    return q ? projects.filter((p) => normalizeSearch(p.title).includes(q)).slice(0, 30) : []
  }, [query, projects])

  const pick = (projectId: string | null) => {
    onChange(projectId)
    setOpen(false)
  }

  // À l'ouverture : au niveau du projet choisi, pour voir ses voisins
  const onOpenChange = (next: boolean) => {
    if (next) {
      setQuery("")
      setLevel(selected?.parentId && byId.has(selected.parentId) ? selected.parentId : null)
    }
    setOpen(next)
  }

  const row = (p: Project) => {
    const hasChildren = (childrenOf.get(p.id) || []).length > 0
    return (
      <li key={p.id} className="flex items-stretch">
        <button
          type="button"
          onClick={() => pick(p.id)}
          className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted", value === p.id && "font-medium")}
        >
          <Check className={cn("size-4 shrink-0", value === p.id ? "text-primary" : "invisible")} />
          <span className="truncate">{p.title}</span>
          {p.completedAt && <span className="shrink-0 text-xs text-muted-foreground">archivé</span>}
        </button>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setLevel(p.id)}
            className="flex w-11 shrink-0 items-center justify-center gap-0.5 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Voir les sous-projets de ${p.title}`}
            title="Sous-projets"
          >
            {(childrenOf.get(p.id) || []).length}
            <ChevronRight className="size-4" />
          </button>
        )}
      </li>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between gap-2 px-3 font-normal", size === "sm" && "h-8", className)}
        >
          <span className={cn("flex min-w-0 items-center gap-2", !selected && "text-muted-foreground")}>
            <FolderOpen className="size-4 shrink-0" />
            <span className="truncate">{selected ? projectPath(selected.id, byId) : noneLabel}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus placeholder="Rechercher un projet…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 pl-8" />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-1">
          {query.trim() ? (
            results.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucun projet</p>
            ) : (
              <ul>
                {results.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => pick(p.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted">
                      <Check className={cn("size-4 shrink-0", value === p.id ? "text-primary" : "invisible")} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{p.title}</span>
                        {p.parentId && <span className="block truncate text-xs text-muted-foreground">{projectPath(p.parentId, byId)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul>
              {current ? (
                <>
                  <li>
                    <button
                      type="button"
                      onClick={() => setLevel(current.parentId && byId.has(current.parentId) ? current.parentId : null)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ArrowLeft className="size-4" />
                      <span className="truncate">{current.parentId ? projectPath(current.parentId, byId) : "Tous les projets"}</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => pick(current.id)}
                      className="flex w-full items-center gap-2 rounded-md bg-muted/50 px-2 py-2 text-left text-sm font-medium hover:bg-muted"
                    >
                      <Check className={cn("size-4 shrink-0", value === current.id ? "text-primary" : "invisible")} />
                      <span className="truncate">Choisir « {current.title} »</span>
                    </button>
                  </li>
                  <li className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">Ou un de ses sous-projets</li>
                </>
              ) : (
                <li>
                  <button type="button" onClick={() => pick(null)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted">
                    <Check className={cn("size-4 shrink-0", !value ? "text-primary" : "invisible")} />
                    {noneLabel}
                  </button>
                </li>
              )}
              {items.map(row)}
              {!current && items.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Aucun projet</li>}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
