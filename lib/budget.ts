// Budget : périodes (mois / semaine) et montants, partagé entre le navigateur et le serveur.

import { addDays, addMonths, endOfWeek, startOfWeek } from "@/lib/projects/core"

export type BudgetPeriod = "monthly" | "weekly"

export interface PeriodRange {
  from: string
  to: string
  // Nombre de jours de la période
  days: number
}

/** Période (mois ou semaine du lundi au dimanche) qui contient `day`. */
export function periodRange(period: BudgetPeriod, day: string): PeriodRange {
  if (period === "weekly") {
    return { from: startOfWeek(day), to: endOfWeek(day), days: 7 }
  }
  const from = `${day.slice(0, 7)}-01`
  const to = addDays(addMonths(from, 1), -1)
  return { from, to, days: Number(to.slice(8)) }
}

/** Période précédente (-1) ou suivante (+1). */
export function shiftPeriod(period: BudgetPeriod, from: string, step: number): string {
  return period === "weekly" ? addDays(from, step * 7) : addMonths(from, step)
}

/** Coût d'abonnements mensuel ramené à la période. */
export function subscriptionsForPeriod(monthlyTotal: number, period: BudgetPeriod): number {
  return period === "weekly" ? (monthlyTotal * 12) / 52 : monthlyTotal
}

/** Saisie "12,5" / "12.50" / 12.5 → 12.5 arrondi au centime, ou null. */
export function parseMoney(input: unknown): number | null {
  const value = typeof input === "number" ? input : typeof input === "string" ? parseFloat(input.replace(/\s/g, "").replace(",", ".")) : NaN
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

export const formatMoney = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 })
