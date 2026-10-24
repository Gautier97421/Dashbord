// Libellés, icônes et couleurs des statuts / priorités / récurrences de tâches (interface).

import { Circle, CircleCheck, CircleDot, CirclePause, type LucideIcon } from "lucide-react"
import type { Priority, Recurrence, TaskStatus } from "@/lib/types"

export const TASK_STATUSES: { value: TaskStatus; label: string; icon: LucideIcon; className: string }[] = [
  { value: "todo", label: "À faire", icon: Circle, className: "text-muted-foreground" },
  { value: "in_progress", label: "En cours", icon: CircleDot, className: "text-warning" },
  { value: "waiting", label: "En attente", icon: CirclePause, className: "text-sky-600 dark:text-sky-400" },
  { value: "done", label: "Terminé", icon: CircleCheck, className: "text-success" },
]

export const taskStatusMeta = (status?: TaskStatus) => TASK_STATUSES.find((s) => s.value === status) ?? TASK_STATUSES[0]

export const PRIORITIES: { value: Priority; label: string; className: string; badge: string }[] = [
  { value: "low", label: "Basse", className: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
  { value: "medium", label: "Normale", className: "text-foreground", badge: "bg-secondary text-secondary-foreground" },
  { value: "high", label: "Haute", className: "text-warning", badge: "bg-warning/15 text-warning-foreground dark:text-warning" },
  { value: "urgent", label: "Urgente", className: "text-destructive", badge: "bg-destructive/15 text-destructive" },
]

export const priorityMeta = (priority?: Priority | null) => PRIORITIES.find((p) => p.value === priority)

export const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "daily", label: "Chaque jour" },
  { value: "weekly", label: "Chaque semaine" },
  { value: "monthly", label: "Chaque mois" },
]

export const recurrenceLabel = (r?: Recurrence | null) => RECURRENCES.find((x) => x.value === r)?.label

/** Recherche sans accents ni majuscules */
export const normalizeSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
