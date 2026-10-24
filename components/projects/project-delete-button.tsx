"use client"

import { DeleteButton } from "@/components/delete-button"
import type { Project } from "@/lib/types"

/** Corbeille animée d'un projet : avertissement (avec le nombre de sous-projets emportés) puis corbeille. */
export function ProjectDeleteButton({
  project,
  descendants,
  onDelete,
  size,
}: {
  project: Project
  descendants: number
  onDelete: () => void
  size?: "sm" | "md"
}) {
  return (
    <DeleteButton
      size={size}
      label="Supprimer le projet"
      onDelete={onDelete}
      confirm={{
        title: `Mettre « ${project.title} » à la corbeille ?`,
        description: `${
          descendants > 0 ? `Ses ${descendants} sous-projet${descendants > 1 ? "s" : ""} et toutes les tâches partent avec lui.` : "Ses tâches partent avec lui."
        } Tu pourras tout restaurer depuis la corbeille pendant 30 jours.`,
        confirmLabel: "Mettre à la corbeille",
      }}
    />
  )
}
