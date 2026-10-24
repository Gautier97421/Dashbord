"use client"

import { useCallback } from "react"
import { useApp } from "@/lib/store-api"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { formatDay } from "@/lib/projects/core"
import type { Task, TaskStatus } from "@/lib/types"

// Valeur d'un champ optionnel à effacer : null est envoyé tel quel à l'API, qui vide alors le champ
// (undefined, lui, disparaît du JSON et laisse le champ inchangé)
export const CLEARED = null as unknown as undefined

// Actions courantes sur une tâche, avec un message en cas d'échec (les vues les partagent)
export function useTaskActions() {
  const { addTask, updateTask, deleteTask, refresh } = useApp()
  const { toast } = useToast()

  const fail = useCallback(
    (title: string) => toast({ title, description: "Vérifie ta connexion puis réessaie.", variant: "destructive" }),
    [toast]
  )

  const patch = useCallback(
    async (task: Task, changes: Partial<Task>) => {
      try {
        await updateTask({ ...task, ...changes })
        return true
      } catch (error: any) {
        // Ex. dépendance qui créerait une boucle : le serveur explique pourquoi
        toast({ title: "Modification impossible", description: error?.message || "Réessaie dans un instant.", variant: "destructive" })
        return false
      }
    },
    [updateTask, toast]
  )

  const setStatus = useCallback(
    (task: Task, status: TaskStatus) =>
      patch(task, { status, completedAt: status === "done" ? task.completedAt || new Date().toISOString() : undefined }),
    [patch]
  )

  const toggleDone = useCallback(
    (task: Task) => setStatus(task, task.status === "done" ? "todo" : "done"),
    [setStatus]
  )

  const duplicate = useCallback(
    async (task: Task) => {
      try {
        return await addTask({
          title: `${task.title} (copie)`,
          description: task.description,
          notes: task.notes,
          priority: task.priority,
          status: "todo",
          dueDate: task.dueDate,
          startDate: task.startDate,
          projectId: task.projectId,
          checklist: (task.checklist || []).map((i) => ({ ...i, done: false })),
          links: task.links,
          dependsOn: task.dependsOn,
          recurrence: task.recurrence,
        })
      } catch {
        fail("Duplication impossible")
        return null
      }
    },
    [addTask, fail]
  )

  // Mise à la corbeille, annulable depuis le message
  const remove = useCallback(
    async (task: Task) => {
      try {
        await deleteTask(task.id)
      } catch {
        fail("Suppression impossible")
        return
      }
      toast({
        title: "Tâche mise à la corbeille",
        description: task.title,
        action: (
          <ToastAction
            altText="Annuler la suppression"
            onClick={async () => {
              await fetch("/api/trash", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "restore", type: "task", id: task.id }),
              })
              await refresh()
            }}
          >
            Annuler
          </ToastAction>
        ),
      })
    },
    [deleteTask, fail, refresh, toast]
  )

  // Affichage dans le calendrier principal (à l'échéance de la tâche)
  const toggleCalendar = useCallback(
    async (task: Task) => {
      const on = !task.showInCalendar
      if (!(await patch(task, { showInCalendar: on })) || !on) return
      toast(
        task.dueDate
          ? { title: "Ajoutée au calendrier", description: `Visible le ${formatDay(task.dueDate.slice(0, 10), true)} dans le calendrier principal.` }
          : { title: "Ajoutée au calendrier", description: "Elle y apparaîtra dès qu'elle aura une échéance." }
      )
    },
    [patch, toast]
  )

  return { patch, setStatus, toggleDone, duplicate, remove, toggleCalendar }
}
