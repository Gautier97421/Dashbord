"use client"

import type { ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getToday, toLocalDateString } from "@/lib/helpers"

export const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

export interface CalendarDay {
  date: Date
  // AAAA-MM-JJ, en heure locale
  key: string
  inMonth: boolean
  isToday: boolean
}

// "AAAA-MM-JJ" lu en heure locale (new Date("AAAA-MM-JJ") le lirait en UTC)
function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d || 1)
}

/** Semaines complètes (lundi → dimanche) couvrant le mois du jour donné. */
export function monthDays(day: string): CalendarDay[] {
  const ref = parseDay(day)
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()
  const total = Math.ceil((lead + daysInMonth) / 7) * 7
  const today = getToday()
  return Array.from({ length: total }, (_, i) => {
    const date = new Date(first.getFullYear(), first.getMonth(), 1 - lead + i)
    const key = toLocalDateString(date)
    return { date, key, inMonth: date.getMonth() === first.getMonth(), isToday: key === today }
  })
}

/** Premier jour du mois décalé de `delta` mois (sans débordement du 31 vers le mois suivant). */
export function shiftMonth(day: string, delta: number) {
  const ref = parseDay(day)
  return toLocalDateString(new Date(ref.getFullYear(), ref.getMonth() + delta, 1))
}

export function monthLabel(day: string) {
  const label = parseDay(day).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Navigation de mois : ‹ Octobre 2026 › Aujourd'hui. Le libellé se tronque plutôt que de déborder
 * et le groupe passe à la ligne quand la place manque.
 */
export function MonthNav({
  label,
  onPrev,
  onNext,
  onToday,
  className,
}: {
  label: ReactNode
  onPrev: () => void
  onNext: () => void
  // Absent : pas de bouton « Aujourd'hui »
  onToday?: () => void
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 max-w-full items-center gap-1", className)}>
      <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={onPrev} aria-label="Mois précédent">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-0 truncate px-1 text-center text-sm font-medium @2xl/main:min-w-32">{label}</span>
      <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={onNext} aria-label="Mois suivant">
        <ChevronRight className="size-4" />
      </Button>
      {onToday && (
        <Button variant="outline" size="sm" className="ml-1 shrink-0" onClick={onToday}>
          Aujourd&apos;hui
        </Button>
      )}
    </div>
  )
}

/**
 * Numéro du jour, entouré s'il s'agit d'aujourd'hui, suivi du mot « Aujourd'hui » quand la case est
 * assez large. La case parente doit être un conteneur (`@container`).
 */
export function DayNumber({ day, isToday, className }: { day: number; isToday: boolean; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1", className)}>
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
          isToday && "bg-primary font-semibold text-primary-foreground"
        )}
      >
        {day}
      </span>
      {isToday && (
        <span className="hidden truncate rounded-full bg-primary/15 px-1.5 text-[10px] font-medium leading-5 text-primary @min-[7rem]:inline">
          Aujourd&apos;hui
        </span>
      )}
    </span>
  )
}

/** Grille mensuelle commune (Sport, Sommeil…) : en-têtes Lun → Dim et une case par jour. */
export function MonthCalendar({
  day,
  renderDay,
  onDayClick,
  dayClassName,
  selected,
}: {
  // N'importe quel jour du mois affiché (AAAA-MM-JJ)
  day: string
  renderDay?: (day: CalendarDay) => ReactNode
  onDayClick?: (day: CalendarDay) => void
  dayClassName?: (day: CalendarDay) => string | false | undefined
  selected?: string
}) {
  const days = monthDays(day)
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((d) => (
          <div key={d} className="truncate py-1.5 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <div
            key={d.key}
            role={onDayClick ? "button" : undefined}
            tabIndex={onDayClick ? 0 : undefined}
            onClick={onDayClick ? () => onDayClick(d) : undefined}
            onKeyDown={
              onDayClick
                ? (e) => {
                    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault()
                      onDayClick(d)
                    }
                  }
                : undefined
            }
            className={cn(
              "@container group/day relative flex min-h-16 min-w-0 flex-col gap-0.5 border-b border-r p-1 text-left transition-colors sm:min-h-24 [&:nth-child(7n)]:border-r-0",
              onDayClick && "cursor-pointer hover:bg-muted/40",
              !d.inMonth && "bg-muted/20 text-muted-foreground",
              d.isToday && "bg-primary/5",
              dayClassName?.(d),
              selected === d.key && "ring-1 ring-inset ring-primary"
            )}
          >
            <DayNumber day={d.date.getDate()} isToday={d.isToday} />
            {renderDay?.(d)}
          </div>
        ))}
      </div>
    </div>
  )
}
