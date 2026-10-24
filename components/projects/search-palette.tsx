"use client"

import { useEffect, useMemo, useState } from "react"
import { FolderOpen, Link2, MessageSquare } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useApp } from "@/lib/store-api"
import { normalizeSearch } from "@/lib/projects/meta"
import { projectPath, useProjectsUI } from "./context"
import { TaskStatusIcon } from "./task-row"
import type { ActivityItem } from "./activity-panel"

const LIMIT = 8

/** Recherche globale : projets, tâches, liens et commentaires depuis une seule barre (Ctrl + K). */
export function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state } = useApp()
  const { tasks, projectById, openProject, openTask } = useProjectsUI()
  const [query, setQuery] = useState("")
  const [comments, setComments] = useState<ActivityItem[]>([])
  const q = normalizeSearch(query.trim())

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  // Les commentaires ne sont pas chargés dans l'app : recherche côté serveur, après une courte pause de frappe
  useEffect(() => {
    if (q.length < 2) {
      setComments([])
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/project-activity?q=${encodeURIComponent(query.trim())}&limit=${LIMIT}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setComments)
        .catch(() => setComments([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [q, query])

  const results = useMemo(() => {
    if (!q) return { projects: [], tasks: [], links: [] }
    const has = (...texts: (string | undefined | null)[]) => normalizeSearch(texts.filter(Boolean).join(" ")).includes(q)
    const projects = state.projects
      .filter((p) => has(p.title, p.description, p.notes, p.category, ...(p.objectives || [])))
      .slice(0, LIMIT)
    const matchedTasks = tasks
      .filter((t) => has(t.title, t.description, t.notes, ...(t.checklist || []).map((i) => i.text)))
      .slice(0, LIMIT)
    const links = [
      ...state.projects.flatMap((p) => (p.links || []).map((l) => ({ link: l, projectId: p.id, taskId: undefined as string | undefined, owner: p.title }))),
      ...tasks.flatMap((t) => (t.links || []).map((l) => ({ link: l, projectId: t.projectId, taskId: t.id as string | undefined, owner: t.title }))),
    ]
      .filter(({ link }) => has(link.label, link.url))
      .slice(0, LIMIT)
    return { projects, tasks: matchedTasks, links }
  }, [q, state.projects, tasks])

  const go = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }

  const nothing = q && !results.projects.length && !results.tasks.length && !results.links.length && !comments.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[10%] max-w-[94vw] translate-y-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Rechercher</DialogTitle>
          <DialogDescription>Projets, tâches, liens et commentaires</DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-muted-foreground">
          <CommandInput placeholder="Rechercher un projet, une tâche, un lien, un commentaire…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[60vh]">
            {!q && <p className="py-6 text-center text-sm text-muted-foreground">Tape au moins un mot</p>}
            {nothing && <CommandEmpty>Aucun résultat</CommandEmpty>}
            {results.projects.length > 0 && (
              <CommandGroup heading="Projets">
                {results.projects.map((p) => (
                  <CommandItem key={p.id} value={`p-${p.id}`} onSelect={() => go(() => openProject(p.id))}>
                    <FolderOpen className="text-primary" />
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    {p.parentId && <span className="max-w-[45%] truncate text-xs text-muted-foreground">{projectPath(p.parentId, projectById)}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.tasks.length > 0 && (
              <CommandGroup heading="Tâches">
                {results.tasks.map((t) => (
                  <CommandItem key={t.id} value={`t-${t.id}`} onSelect={() => go(() => openTask(t.id))}>
                    <TaskStatusIcon status={t.status} />
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    {t.projectId && <span className="max-w-[45%] truncate text-xs text-muted-foreground">{projectPath(t.projectId, projectById)}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.links.length > 0 && (
              <CommandGroup heading="Liens">
                {results.links.map(({ link, projectId, taskId, owner }) => (
                  <CommandItem
                    key={`${taskId || projectId}-${link.id}`}
                    value={`l-${taskId || projectId}-${link.id}`}
                    onSelect={() => go(() => (taskId ? openTask(taskId) : projectId && openProject(projectId)))}
                  >
                    <Link2 className="text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{link.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{link.url}</span>
                    </span>
                    <span className="max-w-[35%] truncate text-xs text-muted-foreground">{owner}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {comments.length > 0 && (
              <CommandGroup heading="Commentaires">
                {comments.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`c-${c.id}`}
                    onSelect={() => go(() => (c.taskId ? openTask(c.taskId) : c.projectId && openProject(c.projectId)))}
                  >
                    <MessageSquare className="text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2">{c.message}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.taskTitle || c.projectTitle}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
