"use client"

import { AlarmClock, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, MapPin, Navigation, Ticket, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  budgetStats,
  countdown,
  daysBetween,
  formatDay,
  formatMoney,
  formatRange,
  sortActivities,
  toMinutes,
  tripDeadlines,
  tripPhase,
  type Trip,
} from "@/lib/travel/shared"
import { useTravel } from "./context"
import { Bar, Empty, PhaseBadge, Section } from "./ui"
import { SharedWith } from "./trips"

export function OverviewView({ onTravelMode }: { onTravelMode: (tripId: string) => void }) {
  const { trips, today, openTab } = useTravel()
  const active = trips.filter((t) => !t.archived && !t.cancelled)
  const ongoing = active.filter((t) => tripPhase(t, today) === "ongoing")
  const upcoming = active.filter((t) => tripPhase(t, today) === "upcoming").sort((a, b) => a.startDate.localeCompare(b.startDate))
  const past = trips.filter((t) => !t.archived && (tripPhase(t, today) === "past" || t.cancelled)).sort((a, b) => b.endDate.localeCompare(a.endDate))

  const deadlines = [...ongoing, ...upcoming]
    .flatMap((trip) => tripDeadlines(trip, today).map((d) => ({ ...d, trip })))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(0, 10)

  return (
    <div className="space-y-4">
      {ongoing.map((trip) => (
        <OngoingCard key={trip.id} trip={trip} onTravelMode={() => onTravelMode(trip.id)} />
      ))}

      <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          <h2 className="text-sm font-semibold">À venir</h2>
          {upcoming.length === 0 ? (
            <Empty>Aucun voyage à venir.</Empty>
          ) : (
            <div className="grid gap-3 @3xl/main:grid-cols-2">
              {upcoming.map((trip) => (
                <UpcomingCard key={trip.id} trip={trip} onOpen={(tab) => openTab(tab, trip.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Section title="Prochaines échéances" icon={<AlarmClock className="size-4" />}>
            {deadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Rien à prévoir pour l&apos;instant.</p>
            ) : (
              <ul className="space-y-2">
                {deadlines.map((d) => (
                  <li key={`${d.trip.id}:${d.key}`}>
                    <button type="button" onClick={() => openTab(d.kind === "checklist" || d.kind === "documents" || d.kind === "luggage" ? "prep" : "bookings", d.trip.id)} className="w-full text-left">
                      <p className="flex items-baseline gap-2 text-sm">
                        <span className={cn("shrink-0 text-xs tabular-nums", d.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                          {d.day === today ? "Aujourd'hui" : d.overdue ? "En retard" : formatDay(d.day)}
                        </span>
                        <span className="min-w-0 truncate">{d.title}</span>
                      </p>
                      <p className="truncate pl-0 text-xs text-muted-foreground">
                        {d.trip.title}
                        {d.detail ? ` · ${d.detail}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {past.length > 0 && (
            <Section title="Voyages passés" icon={<BookOpen className="size-4" />}>
              <ul className="space-y-1.5">
                {past.slice(0, 5).map((trip) => (
                  <li key={trip.id}>
                    <button type="button" onClick={() => openTab("journal", trip.id)} className="flex w-full items-center gap-2 text-left text-sm">
                      <span className="min-w-0 flex-1 truncate">{trip.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatRange(trip.startDate, trip.endDate)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function OngoingCard({ trip, onTravelMode }: { trip: Trip; onTravelMode: () => void }) {
  const { today, openTab } = useTravel()
  const todays = sortActivities(trip.activities.filter((a) => a.day === today))
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const next = todays.find((a) => !a.done && (toMinutes(a.endTime) ?? toMinutes(a.startTime) ?? 24 * 60) >= nowMin)

  return (
    <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-lg font-semibold">{trip.title}</p>
            <PhaseBadge phase="ongoing" />
          </div>
          <p className="text-sm text-muted-foreground">
            {trip.destination} · {countdown(trip, today)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => openTab("itinerary", trip.id)}>
            <CalendarDays className="size-4" />
            Itinéraire
          </Button>
          <Button size="sm" onClick={onTravelMode}>
            <Navigation className="size-4" />
            Mode voyage
          </Button>
        </div>
      </div>
      {next ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Prochaine étape : </span>
          <span className="font-medium">
            {next.startTime ? `${next.startTime} · ` : ""}
            {next.title}
          </span>
          {next.address && <span className="text-muted-foreground"> · {next.address}</span>}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{todays.length ? "Programme du jour terminé." : "Rien de prévu aujourd'hui."}</p>
      )}
    </div>
  )
}

function UpcomingCard({ trip, onOpen }: { trip: Trip; onOpen: (tab: "itinerary" | "bookings" | "budget" | "prep") => void }) {
  const { today } = useTravel()
  const stats = budgetStats(trip)
  const bookings = trip.bookings.filter((b) => b.status !== "cancelled")
  const confirmed = bookings.filter((b) => b.status === "confirmed" || b.status === "booked").length
  const todo = bookings.length - confirmed
  const prepDone = trip.checklist.filter((c) => c.done).length
  const prepLeft = trip.checklist.length - prepDone
  const next = tripDeadlines(trip, today).slice(0, 2)
  const days = daysBetween(today, trip.startDate)

  return (
    <div className="min-w-0 space-y-3 rounded-xl border bg-card p-3">
      <button type="button" onClick={() => onOpen("itinerary")} className="flex w-full items-start gap-3 text-left">
        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
          <span className="text-xl font-bold leading-none tabular-nums">{days}</span>
          <span className="text-[10px] uppercase">{days > 1 ? "jours" : "jour"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{trip.title}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {trip.destination}
          </p>
          <p className="text-xs text-muted-foreground">{formatRange(trip.startDate, trip.endDate)}</p>
        </div>
      </button>
      {trip.members.length > 0 && <SharedWith trip={trip} />}

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <button type="button" onClick={() => onOpen("budget")} className="min-w-0 rounded-lg bg-muted/60 p-2">
          <Wallet className="mx-auto mb-0.5 size-4 text-muted-foreground" />
          <span className="block truncate font-medium tabular-nums">{formatMoney(stats.committed, trip.currency)}</span>
          <span className="block truncate text-muted-foreground">{stats.budget != null ? `sur ${formatMoney(stats.budget, trip.currency)}` : "engagés"}</span>
        </button>
        <button type="button" onClick={() => onOpen("bookings")} className="min-w-0 rounded-lg bg-muted/60 p-2">
          <Ticket className="mx-auto mb-0.5 size-4 text-muted-foreground" />
          <span className="block truncate font-medium">{confirmed} réservé{confirmed > 1 ? "s" : ""}</span>
          <span className={cn("block truncate", todo ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{todo ? `${todo} à faire` : "rien à faire"}</span>
        </button>
        <button type="button" onClick={() => onOpen("prep")} className="min-w-0 rounded-lg bg-muted/60 p-2">
          <ClipboardCheck className="mx-auto mb-0.5 size-4 text-muted-foreground" />
          <span className="block truncate font-medium tabular-nums">
            {prepDone}/{trip.checklist.length}
          </span>
          <span className={cn("block truncate", prepLeft ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{prepLeft ? `${prepLeft} restant${prepLeft > 1 ? "s" : ""}` : "prêt"}</span>
        </button>
      </div>
      {stats.budget != null && <Bar value={stats.budget ? stats.committed / stats.budget : 0} />}

      {next.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {next.map((d) => (
            <li key={d.key} className="flex items-baseline gap-2">
              <span className={cn("shrink-0 tabular-nums", d.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>{d.overdue ? "En retard" : formatDay(d.day)}</span>
              <span className="truncate">{d.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" />
          Aucune échéance en attente
        </p>
      )}
    </div>
  )
}
