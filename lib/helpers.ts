import type { RoutineLog } from "./types"

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function getToday(): string {
  return new Date().toISOString().split("T")[0]
}

export function formatDateFr(date: string | Date, format: "short" | "long" | "full" = "short"): string {
  const d = new Date(date)
  const options: Intl.DateTimeFormatOptions =
    format === "short"
      ? { day: "numeric", month: "short" }
      : format === "long"
        ? { day: "numeric", month: "long", year: "numeric" }
        : { weekday: "long", day: "numeric", month: "long", year: "numeric" }

  return d.toLocaleDateString("fr-FR", options)
}

export function calculateStreak(logs: RoutineLog[], actionId: string): { current: number; longest: number } {
  const actionLogs = logs
    .filter((l) => l.actionId === actionId && l.completed)
    .map((l) => l.date)
    .sort()
    .reverse()

  if (actionLogs.length === 0) return { current: 0, longest: 0 }

  let current = 0
  let longest = 0
  let streak = 0
  const today = getToday()

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split("T")[0]

  if (actionLogs[0] === today || actionLogs[0] === yesterdayStr) {
    let checkDate = new Date(actionLogs[0])
    for (const log of actionLogs) {
      const logDate = new Date(log)
      const diff = Math.round((checkDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))

      if (diff <= 1) {
        streak++
        checkDate = logDate
      } else {
        break
      }
    }
    current = streak
  }

  streak = 1
  longest = 1
  for (let i = 1; i < actionLogs.length; i++) {
    const prev = new Date(actionLogs[i - 1])
    const curr = new Date(actionLogs[i])
    const diff = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24))

    if (diff === 1) {
      streak++
      longest = Math.max(longest, streak)
    } else {
      streak = 1
    }
  }

  return { current, longest: Math.max(longest, current) }
}
