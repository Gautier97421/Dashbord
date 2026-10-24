import { Circle, CircleCheck, CircleDot, type LucideIcon } from "lucide-react"
import type { ProjectStatus } from "@/lib/types"

// États d'un projet, dans l'ordre affiché dans les menus. L'icône distingue l'état même sans la couleur.
export const PROJECT_STATUSES: { value: ProjectStatus; label: string; icon: LucideIcon; className: string }[] = [
  { value: "not_started", label: "Pas commencé", icon: Circle, className: "text-muted-foreground" },
  { value: "in_progress", label: "En cours", icon: CircleDot, className: "text-warning" },
  { value: "done", label: "Fini", icon: CircleCheck, className: "text-success" },
]

// undefined quand le projet n'a pas d'état : rien n'est alors affiché
export const getProjectStatus = (status?: ProjectStatus | null) =>
  PROJECT_STATUSES.find((s) => s.value === status)
