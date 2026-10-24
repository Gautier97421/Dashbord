"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { PROJECT_STATUSES, getProjectStatus } from "@/lib/project-status"
import type { ProjectStatus } from "@/lib/types"

// Valeur "Aucun état" des sélecteurs d'état (le projet est enregistré avec status = null)
export const NO_STATUS = "none"

export function ProjectStatusLabel({ status, showLabel = true }: { status?: ProjectStatus | null; showLabel?: boolean }) {
  const current = getProjectStatus(status)
  if (!current) return null
  const { label, icon: Icon, className } = current
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", className)}>
      <Icon className={cn("shrink-0", showLabel ? "size-3.5" : "size-4")} />
      <span className={cn(!showLabel && "sr-only")}>{label}</span>
    </span>
  )
}

// Badge d'état cliquable : change l'état sans passer par le formulaire. Sans état, rien n'est affiché
// (l'état se choisit alors dans "Modifier le projet")
export function ProjectStatusPicker({ status, onChange, showLabel = true }: {
  status?: ProjectStatus | null
  onChange: (status: ProjectStatus | null) => void
  showLabel?: boolean
}) {
  const current = getProjectStatus(status)
  if (!current) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center rounded-full transition-colors hover:bg-muted",
            showLabel ? "border px-2 py-0.5" : "p-1"
          )}
          title={`État : ${current.label}`}
          aria-label={`État : ${current.label}. Changer l'état`}
        >
          <ProjectStatusLabel status={current.value} showLabel={showLabel} />
        </button>
      </DropdownMenuTrigger>
      {/* Le menu est rendu en portail mais ses clics remontent quand même jusqu'à la carte */}
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>État</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current.value}
          onValueChange={(v) => onChange(v === NO_STATUS ? null : (v as ProjectStatus))}
        >
          {PROJECT_STATUSES.map(({ value, label, icon: Icon, className }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className={cn("size-4", className)} />
              {label}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value={NO_STATUS} className="text-muted-foreground">
            Aucun état
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
