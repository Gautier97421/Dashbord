"use client"

import { useEffect, useState } from "react"
import { Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { useApp } from "@/lib/store-api"
import { cn } from "@/lib/utils"
import { addDays, dayKey, weekdayIndex } from "@/lib/projects/core"
import { PRIORITIES } from "@/lib/projects/meta"
import { requestProjectsTarget } from "@/lib/projects/nav"
import type { Priority, TaskStatus } from "@/lib/types"
import { ProjectPicker } from "./project-picker"

const NONE = "none"

export interface QuickAddDefaults {
  projectId?: string | null
  dueDate?: string
  status?: TaskStatus
  priority?: Priority
}

type DueChoice = "none" | "today" | "tomorrow" | "monday" | "custom"

export function QuickAddTaskDialog({
  open,
  onOpenChange,
  defaults,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaults?: QuickAddDefaults
  // Après création ; sans ce rappel, le message propose d'ouvrir la tâche dans la section Projets
  onCreated?: (taskId: string) => void
}) {
  const { addTask } = useApp()
  const { toast } = useToast()
  const today = dayKey()
  const [title, setTitle] = useState("")
  const [projectId, setProjectId] = useState<string>(NONE)
  const [priority, setPriority] = useState<Priority>("medium")
  const [due, setDue] = useState<DueChoice>("none")
  const [customDue, setCustomDue] = useState("")
  const [saving, setSaving] = useState(false)


  // Valeurs de départ à chaque ouverture
  useEffect(() => {
    if (!open) return
    setTitle("")
    setProjectId(defaults?.projectId || NONE)
    setPriority(defaults?.priority || "medium")
    if (defaults?.dueDate === today) setDue("today")
    else if (defaults?.dueDate) {
      setDue("custom")
      setCustomDue(defaults.dueDate)
    } else setDue("none")
  }, [open, defaults, today])

  const dueDate =
    due === "today" ? today : due === "tomorrow" ? addDays(today, 1) : due === "monday" ? addDays(today, 7 - weekdayIndex(today)) : due === "custom" ? customDue || undefined : undefined

  const submit = async (keepOpen: boolean) => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const task = await addTask({
        title: title.trim(),
        priority,
        status: defaults?.status || "todo",
        dueDate,
        projectId: projectId === NONE ? undefined : projectId,
      })
      if (onCreated) onCreated(task.id)
      else {
        toast({
          title: "Tâche ajoutée",
          description: task.title,
          action: (
            <ToastAction altText="Voir la tâche" onClick={() => requestProjectsTarget({ taskId: task.id })}>
              Voir
            </ToastAction>
          ),
        })
      }
      if (keepOpen) setTitle("")
      else onOpenChange(false)
    } catch {
      toast({ title: "Tâche non ajoutée", description: "Vérifie ta connexion puis réessaie.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
          <DialogDescription>Ajoutée sans quitter la page en cours.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            autoFocus
            placeholder="Que faut-il faire ?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit(e.shiftKey))}
            aria-label="Titre de la tâche"
          />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Échéance</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={due}
              onValueChange={(v) => v && setDue(v as DueChoice)}
              className="flex w-full flex-wrap justify-start"
            >
              <ToggleGroupItem value="none">Aucune</ToggleGroupItem>
              <ToggleGroupItem value="today">Aujourd&apos;hui</ToggleGroupItem>
              <ToggleGroupItem value="tomorrow">Demain</ToggleGroupItem>
              <ToggleGroupItem value="monday">Lundi</ToggleGroupItem>
              <ToggleGroupItem value="custom">Date…</ToggleGroupItem>
            </ToggleGroup>
            {due === "custom" && <Input type="date" value={customDue} onChange={(e) => setCustomDue(e.target.value)} aria-label="Date d'échéance" />}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Projet</Label>
            <ProjectPicker value={projectId === NONE ? null : projectId} onChange={(id) => setProjectId(id || NONE)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(({ value, label, className }) => (
                    <SelectItem key={value} value={value}>
                      <Flag className={cn("size-4", className)} />
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => submit(true)} disabled={!title.trim() || saving} title="Maj + Entrée">
            Ajouter et continuer
          </Button>
          <Button onClick={() => submit(false)} disabled={!title.trim() || saving}>
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
