"use client"

import type { ReactNode } from "react"
import { Calendar, CalendarCheck, CopyPlus, ExternalLink, Flag, ListChecks, Lock, Repeat, Waypoints } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DeleteButton } from "@/components/delete-button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { addDays, daysBetween, formatDay, relativeDay, weekdayIndex } from "@/lib/projects/core"
import { PRIORITIES, TASK_STATUSES, priorityMeta, recurrenceLabel, taskStatusMeta } from "@/lib/projects/meta"
import type { Priority, Task, TaskStatus } from "@/lib/types"
import { projectPath, useProjectsUI } from "./context"
import { CLEARED, useTaskActions } from "./use-task-actions"
import { MoreDots } from "@/components/lottie"

export function DueChip({ day, today, done, label }: { day: string; today: string; done?: boolean; label?: string }) {
  const diff = daysBetween(today, day)
  const tone = done ? "text-muted-foreground" : diff < 0 ? "text-destructive font-medium" : diff === 0 ? "text-warning font-medium" : "text-muted-foreground"
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs whitespace-nowrap", tone)} title={`${label || "Échéance"} : ${formatDay(day, true)}`}>
      <Calendar className="size-3 shrink-0" />
      {relativeDay(day, today)}
    </span>
  )
}

export function PriorityBadge({ priority, always = false }: { priority?: Priority | null; always?: boolean }) {
  const meta = priorityMeta(priority)
  if (!meta || (!always && priority !== "high" && priority !== "urgent")) return null
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.badge)}>
      <Flag className="size-2.5" />
      {meta.label}
    </span>
  )
}

export function TaskStatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = taskStatusMeta(status)
  const Icon = meta.icon
  return <Icon className={cn("size-3.5 shrink-0", meta.className, className)} aria-label={meta.label} />
}

// Lundi prochain (raccourci d'échéance)
const nextMonday = (today: string) => addDays(today, 7 - weekdayIndex(today))

export function TaskMenu({ task, align = "end", triggerClassName }: { task: Task; align?: "start" | "end"; triggerClassName?: string }) {
  const { openTask, today } = useProjectsUI()
  const { setStatus, patch, duplicate, toggleCalendar } = useTaskActions()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("size-7 shrink-0 hover:bg-transparent hover:text-foreground dark:hover:bg-transparent", triggerClassName)} aria-label={`Actions pour ${task.title}`}>
          <MoreDots />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52">
        <DropdownMenuItem onClick={() => openTask(task.id)}>
          <ExternalLink className="size-4" />
          Ouvrir la fiche
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Statut</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={task.status} onValueChange={(v) => setStatus(task, v as TaskStatus)}>
              {TASK_STATUSES.map(({ value, label, icon: Icon, className }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  <Icon className={cn("size-4", className)} />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Priorité</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={task.priority} onValueChange={(v) => patch(task, { priority: v as Priority })}>
              {PRIORITIES.map(({ value, label, className }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  <Flag className={cn("size-4", className)} />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Échéance</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => patch(task, { dueDate: today })}>Aujourd&apos;hui</DropdownMenuItem>
            <DropdownMenuItem onClick={() => patch(task, { dueDate: addDays(today, 1) })}>Demain</DropdownMenuItem>
            <DropdownMenuItem onClick={() => patch(task, { dueDate: nextMonday(today) })}>Lundi prochain</DropdownMenuItem>
            {task.dueDate && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => patch(task, { dueDate: CLEARED })}>Sans échéance</DropdownMenuItem>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuCheckboxItem checked={!!task.showInCalendar} onCheckedChange={() => toggleCalendar(task)}>
          Afficher dans le calendrier
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => duplicate(task)}>
          <CopyPlus className="size-4" />
          Dupliquer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Indicateurs d'une tâche : échéance, priorité, checklist, blocage, récurrence. */
export function TaskIndicators({ task, compact = false }: { task: Task; compact?: boolean }) {
  const { today, alertsByTask, tasks } = useProjectsUI()
  const done = task.status === "done"
  const alerts = alertsByTask.get(task.id) || []
  const blocked = alerts.find((a) => a.kind === "task_blocked")
  const blocking = alerts.find((a) => a.kind === "task_blocking")
  const checklist = task.checklist || []
  const checked = checklist.filter((i) => i.done).length
  const status = taskStatusMeta(task.status)
  const dependents = blocking ? tasks.filter((t) => t.status !== "done" && t.dependsOn?.includes(task.id)).length : 0

  return (
    <>
      {(task.status === "in_progress" || task.status === "waiting") && (
        <span className={cn("inline-flex items-center gap-1 text-xs", status.className)}>
          <status.icon className="size-3" />
          {!compact && status.label}
        </span>
      )}
      {task.dueDate && <DueChip day={task.dueDate} today={today} done={done} />}
      <PriorityBadge priority={task.priority} />
      {checklist.length > 0 && (
        <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums", checked === checklist.length ? "text-success" : "text-muted-foreground")} title="Sous-tâches terminées">
          <ListChecks className="size-3" />
          {checked}/{checklist.length}
        </span>
      )}
      {blocked && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive" title={blocked.body}>
          <Lock className="size-3" />
          {!compact && "Bloquée"}
        </span>
      )}
      {blocking && (
        <span className="inline-flex items-center gap-1 text-xs text-warning" title={blocking.body}>
          <Waypoints className="size-3" />
          {!compact && `Bloque ${dependents}`}
        </span>
      )}
      {task.recurrence && (
        <span className="inline-flex items-center text-xs text-muted-foreground" title={recurrenceLabel(task.recurrence)}>
          <Repeat className="size-3" />
        </span>
      )}
      {task.showInCalendar && (
        <span className="inline-flex items-center text-xs text-primary" title="Affichée dans le calendrier principal">
          <CalendarCheck className="size-3" />
        </span>
      )}
    </>
  )
}

/** Corbeille animée d'une tâche, avec avertissement avant suppression. */
export function TaskDeleteButton({ task, className }: { task: Task; className?: string }) {
  const { remove } = useTaskActions()
  return (
    <DeleteButton
      label="Supprimer la tâche"
      onDelete={() => remove(task)}
      confirm={{
        title: `Supprimer « ${task.title} » ?`,
        description: "Elle part à la corbeille : tu pourras la restaurer pendant 30 jours.",
        confirmLabel: "Supprimer",
      }}
      className={className}
    />
  )
}

interface TaskRowProps {
  task: Task
  showProject?: boolean
  compact?: boolean
  // Poignée de glisser-déposer, placée avant la case à cocher
  dragHandle?: ReactNode
  className?: string
}

export function TaskRow({ task, showProject = true, compact, dragHandle, className }: TaskRowProps) {
  const ui = useProjectsUI()
  const { toggleDone } = useTaskActions()
  const isCompact = compact ?? ui.compactTasks
  const done = task.status === "done"
  const path = showProject ? projectPath(task.projectId, ui.projectById) : null

  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-lg border bg-card px-2.5 transition-colors hover:bg-muted/40",
        isCompact ? "py-1.5" : "py-2.5",
        done && "opacity-70",
        className
      )}
    >
      {dragHandle}
      <Checkbox
        className={cn("shrink-0", isCompact ? "mt-[3px]" : "mt-0.5")}
        checked={done}
        onCheckedChange={() => toggleDone(task)}
        aria-label={done ? `Rouvrir « ${task.title} »` : `Terminer « ${task.title} »`}
      />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => ui.openTask(task.id)}>
        {isCompact ? (
          <span className="flex items-center gap-2">
            <span className={cn("min-w-0 flex-1 truncate text-sm", done && "text-muted-foreground line-through")}>{task.title}</span>
            {path && <span className="hidden max-w-[40%] truncate text-xs text-muted-foreground md:inline">{path}</span>}
            <span className="flex shrink-0 items-center gap-1.5">
              <TaskIndicators task={task} compact />
            </span>
          </span>
        ) : (
          <>
            <span className={cn("line-clamp-2 text-sm font-medium", done && "text-muted-foreground line-through")}>{task.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
              {path && <span className="truncate">{path}</span>}
              <TaskIndicators task={task} />
            </span>
          </>
        )}
      </button>
      <span className={cn("flex shrink-0 items-center", isCompact ? "-my-1" : "-my-0.5")}>
        <TaskMenu task={task} triggerClassName="opacity-60 group-hover:opacity-100" />
        <TaskDeleteButton task={task} />
      </span>
    </div>
  )
}
