"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronRight, CopyPlus, Flag, Link2, ListChecks, Lock, MessageSquare, Paperclip, Plus, Repeat, StickyNote, Waypoints, X } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useIsMobile } from "@/hooks/use-mobile"
import { useApp } from "@/lib/store-api"
import { cn } from "@/lib/utils"
import { generateId } from "@/lib/helpers"
import { createsDependencyCycle, formatDay } from "@/lib/projects/core"
import { PRIORITIES, RECURRENCES, TASK_STATUSES } from "@/lib/projects/meta"
import type { ChecklistItem, Priority, Recurrence, Task, TaskStatus } from "@/lib/types"
import { projectPath, useProjectsUI } from "./context"
import { ProjectPicker } from "./project-picker"
import { CLEARED, useTaskActions } from "./use-task-actions"
import { TaskStatusIcon } from "./task-row"
import { ActivityPanel } from "./activity-panel"
import { AttachmentsPanel } from "./attachments-panel"
import { ResourceLinks } from "./resource-links"
import { DeleteButton } from "@/components/delete-button"
import { Switch } from "@/components/ui/switch"

const NONE = "none"

function Section({ icon: Icon, title, children, action }: { icon: typeof Flag; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function TaskSheet() {
  const { openTaskId, openTask } = useProjectsUI()
  const { state } = useApp()
  const isMobile = useIsMobile()
  const task = openTaskId ? state.tasks.find((t) => t.id === openTaskId) : undefined

  // Tâche disparue (supprimée ailleurs) : la fiche se ferme
  useEffect(() => {
    if (openTaskId && !task && state.tasks.length) openTask(null)
  }, [openTaskId, task, state.tasks.length, openTask])

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && openTask(null)}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("gap-0 p-0", isMobile ? "h-[92dvh] rounded-t-2xl" : "w-full sm:max-w-xl")}
      >
        {task && <TaskSheetBody key={task.id} task={task} />}
      </SheetContent>
    </Sheet>
  )
}

function TaskSheetBody({ task }: { task: Task }) {
  const { tasks, projectById, openTask, openProject, alertsByTask } = useProjectsUI()
  const { patch, setStatus, duplicate, remove, toggleCalendar } = useTaskActions()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || "")
  const [notes, setNotes] = useState(task.notes || "")
  const [newItem, setNewItem] = useState("")

  useEffect(() => setTitle(task.title), [task.title])
  useEffect(() => setDescription(task.description || ""), [task.description])
  useEffect(() => setNotes(task.notes || ""), [task.notes])

  const checklist = task.checklist || []
  const checked = checklist.filter((i) => i.done).length
  const deps = (task.dependsOn || []).map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => !!t)
  const dependents = tasks.filter((t) => t.dependsOn?.includes(task.id))
  const alerts = alertsByTask.get(task.id) || []
  const path = projectPath(task.projectId, projectById)

  const saveText = (field: "description" | "notes", value: string) => {
    if ((task[field] || "") !== value) patch(task, { [field]: value || CLEARED })
  }
  const setChecklist = (items: ChecklistItem[]) => patch(task, { checklist: items })

  const addItem = () => {
    if (!newItem.trim()) return
    setChecklist([...checklist, { id: generateId(), text: newItem.trim(), done: false }])
    setNewItem("")
  }

  return (
    <>
      <SheetHeader className="gap-2 border-b p-4 pr-12">
        <SheetTitle className="sr-only">Fiche de la tâche</SheetTitle>
        <SheetDescription className="sr-only">Détails, sous-tâches, ressources et activité de la tâche</SheetDescription>
        {path && task.projectId && (
          <button
            type="button"
            className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground hover:underline"
            onClick={() => {
              openTask(null)
              openProject(task.projectId!)
            }}
          >
            {path}
            <ChevronRight className="size-3" />
          </button>
        )}
        <div className="flex items-start gap-2">
          <TaskStatusIcon status={task.status} className="mt-2 size-5" />
          <Textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => (title.trim() && title.trim() !== task.title ? patch(task, { title: title.trim() }) : setTitle(task.title))}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
            rows={1}
            aria-label="Titre de la tâche"
            className={cn(
              "min-h-0 resize-none border-transparent px-1 py-1 text-lg font-semibold shadow-none focus-visible:border-input",
              task.status === "done" && "text-muted-foreground line-through"
            )}
          />
        </div>
        {alerts.length > 0 && (
          <div className="space-y-1">
            {alerts.map((a) => (
              <p
                key={a.dedupeKey}
                className={cn(
                  "rounded-md px-2 py-1 text-xs",
                  a.severity === "high" ? "bg-destructive/10 text-destructive" : a.severity === "medium" ? "bg-warning/15 text-warning-foreground dark:text-warning" : "bg-muted text-muted-foreground"
                )}
              >
                <span className="font-medium">{a.title.split(" : ")[0]}</span> · {a.body}
              </p>
            ))}
          </div>
        )}
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* Propriétés */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Statut</Label>
            <Select value={task.status} onValueChange={(v) => setStatus(task, v as TaskStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map(({ value, label, icon: Icon, className }) => (
                  <SelectItem key={value} value={value}>
                    <Icon className={cn("size-4", className)} />
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Priorité</Label>
            <Select value={task.priority} onValueChange={(v) => patch(task, { priority: v as Priority })}>
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
          <div className="space-y-1">
            <Label htmlFor="task-start" className="text-xs text-muted-foreground">Début</Label>
            <Input id="task-start" type="date" value={task.startDate || ""} onChange={(e) => patch(task, { startDate: e.target.value || CLEARED })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="task-due" className="text-xs text-muted-foreground">Échéance</Label>
            <Input id="task-due" type="date" value={task.dueDate || ""} onChange={(e) => patch(task, { dueDate: e.target.value || CLEARED })} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Projet</Label>
            <ProjectPicker value={task.projectId} onChange={(id) => patch(task, { projectId: id || CLEARED })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Répétition</Label>
            <Select value={task.recurrence || NONE} onValueChange={(v) => patch(task, { recurrence: v === NONE ? null : (v as Recurrence) })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Jamais</SelectItem>
                {RECURRENCES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    <Repeat className="size-4" />
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {task.recurrence && (
          <p className="-mt-3 text-xs text-muted-foreground">
            Une fois terminée, la tâche est recréée avec l&apos;échéance suivante.
          </p>
        )}
        <Label className="-mt-2 flex items-center gap-2 text-sm font-normal">
          <Switch checked={!!task.showInCalendar} onCheckedChange={() => toggleCalendar(task)} />
          Afficher dans le calendrier principal
          {task.showInCalendar && !task.dueDate && <span className="text-xs text-muted-foreground">(dès qu&apos;elle aura une échéance)</span>}
        </Label>

        <div className="space-y-1">
          <Label htmlFor="task-description" className="text-xs text-muted-foreground">Description</Label>
          <Textarea
            id="task-description"
            placeholder="De quoi s'agit-il ?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => saveText("description", description.trim())}
            rows={3}
          />
        </div>

        <Section icon={ListChecks} title={`Sous-tâches${checklist.length ? ` (${checked}/${checklist.length})` : ""}`}>
          {checklist.length > 0 && <Progress value={(checked / checklist.length) * 100} className="h-1.5" />}
          <ul className="space-y-1">
            {checklist.map((item) => (
              <li key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/50">
                <Checkbox
                  checked={item.done}
                  onCheckedChange={() => setChecklist(checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
                  aria-label={item.text}
                />
                <Input
                  defaultValue={item.text}
                  onBlur={(e) => {
                    const text = e.target.value.trim()
                    if (text && text !== item.text) setChecklist(checklist.map((i) => (i.id === item.id ? { ...i, text } : i)))
                  }}
                  className={cn("h-8 flex-1 border-transparent px-1 shadow-none focus-visible:border-input", item.done && "text-muted-foreground line-through")}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"
                  onClick={() => setChecklist(checklist.filter((i) => i.id !== item.id))}
                  aria-label={`Retirer ${item.text}`}
                >
                  <X className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              placeholder="Ajouter une sous-tâche"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
            />
            <Button variant="outline" size="icon" onClick={addItem} disabled={!newItem.trim()} aria-label="Ajouter la sous-tâche">
              <Plus className="size-4" />
            </Button>
          </div>
        </Section>

        <Section
          icon={Lock}
          title="Dépendances"
          action={<DependencyPicker task={task} onPick={(id) => patch(task, { dependsOn: [...(task.dependsOn || []), id] })} />}
        >
          {deps.length === 0 && dependents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune. Ajoute les tâches à terminer avant celle-ci.</p>
          ) : (
            <div className="space-y-2">
              {deps.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Attend :</p>
                  {deps.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 rounded-md border px-2 py-1">
                      <TaskStatusIcon status={d.status} />
                      <button type="button" className={cn("min-w-0 flex-1 truncate text-left text-sm hover:underline", d.status === "done" && "text-muted-foreground line-through")} onClick={() => openTask(d.id)}>
                        {d.title}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground"
                        onClick={() => patch(task, { dependsOn: (task.dependsOn || []).filter((id) => id !== d.id) })}
                        aria-label={`Ne plus attendre ${d.title}`}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {dependents.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Waypoints className="size-3" /> Bloque :
                  </p>
                  {dependents.map((d) => (
                    <button key={d.id} type="button" onClick={() => openTask(d.id)} className="flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left hover:bg-muted/50">
                      <TaskStatusIcon status={d.status} />
                      <span className="truncate text-sm">{d.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section icon={StickyNote} title="Notes">
          <Textarea
            placeholder="Idées, contexte, décisions…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => saveText("notes", notes.trim())}
            rows={4}
          />
        </Section>

        <Section icon={Link2} title="Liens">
          <ResourceLinks links={task.links || []} onChange={(links) => patch(task, { links })} />
        </Section>

        <Section icon={Paperclip} title="Fichiers">
          <AttachmentsPanel taskId={task.id} />
        </Section>

        <Section icon={MessageSquare} title="Commentaires et historique">
          <ActivityPanel taskId={task.id} version={task.updatedAt} />
        </Section>
      </div>

      <div className="flex items-center gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="mr-auto text-xs text-muted-foreground">
          Créée le {formatDay(task.createdAt.slice(0, 10), true)}
          {task.completedAt && ` · terminée le ${formatDay(task.completedAt.slice(0, 10), true)}`}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const copy = await duplicate(task)
            if (copy) openTask(copy.id)
          }}
        >
          <CopyPlus className="size-4" />
          Dupliquer
        </Button>
        <DeleteButton
          size="md"
          label="Supprimer la tâche"
          confirm={{
            title: `Supprimer « ${task.title} » ?`,
            description: "Elle part à la corbeille : tu pourras la restaurer pendant 30 jours.",
          }}
          onDelete={() => {
            openTask(null)
            remove(task)
          }}
        />
      </div>
    </>
  )
}

// Choix d'une tâche à attendre : recherche, et sans les choix qui créeraient une boucle
function DependencyPicker({ task, onPick }: { task: Task; onPick: (id: string) => void }) {
  const { tasks, projectById } = useProjectsUI()
  const [open, setOpen] = useState(false)
  const candidates = useMemo(() => {
    const current = new Set(task.dependsOn || [])
    return tasks
      .filter((t) => t.id !== task.id && !current.has(t.id) && t.status !== "done")
      .filter((t) => !createsDependencyCycle(tasks, task.id, [...current, t.id]))
      // Les tâches du même projet d'abord
      .sort((a, b) => Number(b.projectId === task.projectId) - Number(a.projectId === task.projectId))
  }, [tasks, task])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Attendre une tâche
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder="Rechercher une tâche…" />
          <CommandList>
            <CommandEmpty>Aucune tâche disponible</CommandEmpty>
            <CommandGroup>
              {candidates.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.title} ${t.id}`}
                  onSelect={() => {
                    onPick(t.id)
                    setOpen(false)
                  }}
                >
                  <TaskStatusIcon status={t.status} />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {t.projectId && <span className="max-w-[40%] truncate text-xs text-muted-foreground">{projectById.get(t.projectId)?.title}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
