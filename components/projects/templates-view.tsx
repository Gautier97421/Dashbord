"use client"

import { useCallback, useEffect, useState } from "react"
import { AppWindow, BookmarkPlus, Globe, Layers, Loader2, PartyPopper, User, Wrench } from "lucide-react"
import { DeleteButton } from "@/components/delete-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import * as api from "@/lib/api"
import { useApp } from "@/lib/store-api"
import { BUILTIN_TEMPLATES, countTemplate, type ProjectTemplateData } from "@/lib/project-templates"
import { useProjectsUI } from "./context"
import { ProjectPicker } from "./project-picker"

const ICONS = { globe: Globe, party: PartyPopper, app: AppWindow, wrench: Wrench, user: User }
const NONE = "none"

interface UserTemplate {
  id: string
  name: string
  description: string | null
  data: ProjectTemplateData
}

type Chosen = { builtin?: string; templateId?: string; name: string; defaultTitle: string }

export function TemplatesView() {
  const { state, refresh } = useApp()
  const { today, openProject } = useProjectsUI()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<UserTemplate[]>([])
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [title, setTitle] = useState("")
  const [startDate, setStartDate] = useState(today)
  const [parentId, setParentId] = useState(NONE)
  const [creating, setCreating] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/project-templates")
      if (res.ok) setTemplates(await res.json())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const choose = (c: Chosen) => {
    setChosen(c)
    setTitle(c.defaultTitle)
    setStartDate(today)
    setParentId(NONE)
  }

  const create = async () => {
    if (!chosen) return
    setCreating(true)
    try {
      const { projectId } = await api.projectsApi.fromTemplate({
        builtin: chosen.builtin,
        templateId: chosen.templateId,
        title: title.trim() || undefined,
        startDate,
        parentId: parentId === NONE ? null : parentId,
      })
      await refresh()
      setChosen(null)
      toast({ title: "Projet créé", description: `Depuis le modèle « ${chosen.name} »` })
      openProject(projectId)
    } catch {
      toast({ title: "Création impossible", description: "Réessaie dans un instant.", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const removeTemplate = async (t: UserTemplate) => {
    setTemplates((prev) => prev.filter((x) => x.id !== t.id))
    await fetch(`/api/project-templates?id=${t.id}`, { method: "DELETE" }).catch(() => {})
  }

  const card = (key: string, Icon: typeof Globe, name: string, description: string | null, data: ProjectTemplateData, onUse: () => void, onDelete?: () => void) => {
    const { phases, tasks } = countTemplate(data.root)
    return (
      <Card key={key} className="gap-0 py-0">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold leading-tight">{name}</h3>
              {description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{description}</p>}
            </div>
            {onDelete && (
              <DeleteButton
                label="Supprimer le modèle"
                onDelete={onDelete}
                confirm={{ title: `Supprimer le modèle « ${name} » ?`, description: "Les projets déjà créés avec ce modèle ne sont pas touchés." }}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {phases > 0 && `${phases} étape${phases > 1 ? "s" : ""} · `}
            {tasks} tâche{tasks > 1 ? "s" : ""}
            {data.root.deadlineOffsetDays ? ` · ${data.root.deadlineOffsetDays} jours` : ""}
          </p>
          {(data.root.children || []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(data.root.children || []).map((c) => (
                <span key={c.title} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {c.title}
                </span>
              ))}
            </div>
          )}
          <Button className="mt-auto" size="sm" onClick={onUse}>
            Utiliser ce modèle
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Modèles prêts à l&apos;emploi</h2>
          <p className="text-sm text-muted-foreground">Étapes, tâches habituelles, dates et dépendances préremplies à partir du jour de début choisi.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 @6xl/main:grid-cols-3">
          {BUILTIN_TEMPLATES.map((t) =>
            card(t.key, ICONS[t.icon], t.name, t.description, t.data, () => choose({ builtin: t.key, name: t.name, defaultTitle: t.data.root.title }))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Mes modèles</h2>
            <p className="text-sm text-muted-foreground">Un projet existant, ses sous-projets et ses tâches, réutilisables pour les projets récurrents.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)} disabled={!state.projects.length}>
            <BookmarkPlus className="size-4" />
            Créer depuis un projet
          </Button>
        </div>
        {templates.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            Aucun modèle. Enregistre un projet comme modèle depuis son menu ou avec le bouton ci-dessus.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 @6xl/main:grid-cols-3">
            {templates.map((t) =>
              card(t.id, Layers, t.name, t.description, t.data, () => choose({ templateId: t.id, name: t.name, defaultTitle: t.data.root.title }), () => removeTemplate(t))
            )}
          </div>
        )}
      </section>

      <Dialog open={!!chosen} onOpenChange={(o) => !o && setChosen(null)}>
        <DialogContent className="max-w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau projet</DialogTitle>
            <DialogDescription>Depuis le modèle « {chosen?.name} »</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-title">Nom du projet</Label>
              <Input id="tpl-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-start">Début</Label>
              <Input id="tpl-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || today)} />
              <p className="text-xs text-muted-foreground">Les échéances des étapes et des tâches sont calculées à partir de cette date.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Dans le projet</Label>
              <ProjectPicker value={parentId === NONE ? null : parentId} onChange={(id) => setParentId(id || NONE)} noneLabel="Aucun (projet principal)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChosen(null)}>
              Annuler
            </Button>
            <Button onClick={create} disabled={creating}>
              {creating && <Loader2 className="size-4 animate-spin" />}
              Créer le projet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaveAsTemplateDialog open={saveOpen} onOpenChange={setSaveOpen} onSaved={load} />
    </div>
  )
}

/** Enregistre un projet (sous-projets et tâches compris) comme modèle. `projectId` : projet présélectionné. */
export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  projectId: initialProjectId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  onSaved?: () => void
}) {
  const { state } = useApp()
  const { toast } = useToast()
  const [projectId, setProjectId] = useState(initialProjectId || "")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const id = initialProjectId || ""
    setProjectId(id)
    setName(state.projects.find((p) => p.id === id)?.title || "")
    setDescription("")
    // Valeurs de départ uniquement à l'ouverture (state.projects volontairement absent)
  }, [open, initialProjectId])

  const save = async () => {
    if (!projectId || !name.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/project-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name: name.trim(), description: description.trim() }),
      })
      if (!res.ok) throw new Error()
      toast({ title: "Modèle enregistré", description: `Retrouve-le dans l'onglet Modèles.` })
      onOpenChange(false)
      onSaved?.()
    } catch {
      toast({ title: "Modèle non enregistré", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer comme modèle</DialogTitle>
          <DialogDescription>Sous-projets, tâches, sous-tâches et dates relatives sont repris ; la progression repart de zéro.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!initialProjectId && (
            <div className="space-y-1.5">
              <Label>Projet</Label>
              <ProjectPicker
                value={projectId || null}
                onChange={(id) => {
                  setProjectId(id || "")
                  if (id && !name) setName(state.projects.find((p) => p.id === id)?.title || "")
                }}
                noneLabel="Choisir un projet"
                includeArchived
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nom du modèle</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Refonte de site client" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">Description</Label>
            <Textarea id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !projectId || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
