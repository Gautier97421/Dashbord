"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2, Flag, ListTodo } from "lucide-react"
import { useApp } from "@/lib/store-api"
import { generateId, formatDateFr, getToday, toLocalDateString } from "@/lib/helpers"
import type { CalendarEvent, Priority } from "@/lib/types"
import { cn } from "@/lib/utils"
import { DayNumber } from "@/components/month-calendar"
import { SegmentedTabs } from "@/components/segmented-tabs"
import { toDay } from "@/lib/projects/core"
import { requestProjectsTarget } from "@/lib/projects/nav"

type ViewMode = "day" | "week" | "month"

// Tâche ou projet de la section Projets marqué "Afficher dans le calendrier", placé à son échéance
interface PinnedItem {
  key: string
  kind: "task" | "project"
  id: string
  title: string
  done: boolean
}

function PinnedChip({ item, className }: { item: PinnedItem; className?: string }) {
  const Icon = item.kind === "project" ? Flag : ListTodo
  return (
    <div
      className={cn(
        "flex items-center gap-1 truncate rounded border px-1 py-0.5 text-xs",
        item.done ? "border-transparent bg-muted text-muted-foreground line-through" : "border-warning/30 bg-warning/15 text-warning-foreground dark:text-warning",
        className
      )}
      title={item.kind === "project" ? `Échéance du projet « ${item.title} »` : `Tâche « ${item.title} »`}
    >
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{item.title}</span>
    </div>
  )
}

// Ouvre l'élément dans la section Projets (la page principale y navigue)
const openPinned = (item: PinnedItem) => requestProjectsTarget(item.kind === "task" ? { taskId: item.id } : { projectId: item.id })

function PinnedList({ items, onOpen }: { items: PinnedItem[]; onOpen?: () => void }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      <Label>Projets et tâches</Label>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => {
            onOpen?.()
            openPinned(item)
          }}
          className="flex w-full items-center gap-2 rounded-lg border p-3 text-left hover:bg-muted/50"
        >
          {item.kind === "project" ? <Flag className="size-5 shrink-0 text-warning" /> : <ListTodo className="size-5 shrink-0 text-warning" />}
          <span className={cn("min-w-0 flex-1 truncate", item.done && "line-through text-muted-foreground")}>
            {item.kind === "project" ? `Échéance : ${item.title}` : item.title}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">Ouvrir</span>
        </button>
      ))}
    </div>
  )
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
]

export function CalendarPage() {
  const { state, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = useApp()
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    title: "",
    priority: "medium",
    isRecurring: false,
    completed: false,
  })


  const today = getToday()

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const days: { date: Date; isCurrentMonth: boolean }[] = []

    // Get the day of the week for the first day (0 = Sunday, adjust for Monday start)
    let startDay = firstDay.getDay()
    startDay = startDay === 0 ? 6 : startDay - 1

    // Add days from previous month
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i)
      days.push({ date, isCurrentMonth: false })
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }

    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i)
      days.push({ date, isCurrentMonth: false })
    }

    return days
  }, [currentDate])

  const weekDays = useMemo(() => {
    const days: Date[] = []
    const current = new Date(currentDate)
    const dayOfWeek = current.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    for (let i = 0; i < 7; i++) {
      const date = new Date(current)
      date.setDate(current.getDate() + diff + i)
      days.push(date)
    }

    return days
  }, [currentDate])

  const getEventsForDate = (date: Date) => {
    const dateStr = toLocalDateString(date)
    return (state.calendarEvents || []).filter((e) => e.date === dateStr)
  }

  const pinnedByDay = useMemo(() => {
    const map = new Map<string, PinnedItem[]>()
    const add = (day: string | undefined, item: PinnedItem) => day && map.set(day, [...(map.get(day) || []), item])
    for (const t of state.tasks) {
      if (t.showInCalendar) add(toDay(t.dueDate), { key: `t-${t.id}`, kind: "task", id: t.id, title: t.title, done: t.status === "done" })
    }
    for (const p of state.projects) {
      if (p.showInCalendar) add(toDay(p.deadline), { key: `p-${p.id}`, kind: "project", id: p.id, title: p.title, done: !!p.completedAt || p.status === "done" })
    }
    return map
  }, [state.tasks, state.projects])

  // Les échéances sont des jours locaux : la case du 23 affiche ce qui est dû le 23 (date locale, pas UTC)
  const getPinnedForDate = (date: Date) => pinnedByDay.get(toLocalDateString(date)) || []

  const navigateMonth = (direction: number) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (viewMode === "month") {
        // Le 1er du mois : depuis un 31, setMonth(+1) sauterait au mois d'après
        return new Date(prev.getFullYear(), prev.getMonth() + direction, 1)
      } else if (viewMode === "week") {
        newDate.setDate(prev.getDate() + direction * 7)
      } else {
        newDate.setDate(prev.getDate() + direction)
      }
      return newDate
    })
  }

  const handleAddEvent = async () => {
    if (!newEvent.title || !selectedDate) return

    await addCalendarEvent({
      title: newEvent.title,
      date: selectedDate,
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      priority: newEvent.priority || "medium",
      isRecurring: newEvent.isRecurring || false,
      recurrencePattern: newEvent.recurrencePattern,
      completed: false,
    })

    setNewEvent({
      title: "",
      priority: "medium",
      isRecurring: false,
      completed: false,
    })
    setIsDialogOpen(false)
  }

  const toggleEventComplete = async (eventId: string) => {
    const event = (state.calendarEvents || []).find((e) => e.id === eventId)
    if (event) {
      await updateCalendarEvent({ ...event, completed: !event.completed })
    }
  }

  const deleteEvent = async (eventId: string) => {
    await deleteCalendarEvent(eventId)
  }

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case "high":
        return "bg-destructive/20 text-destructive border-destructive/30"
      case "medium":
        return "bg-primary/20 text-primary border-primary/30"
      case "low":
        return "bg-muted text-muted-foreground border-muted"
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Calendrier</h1>
          <p className="text-sm text-muted-foreground">Planifiez vos événements et tâches</p>
        </div>

        <div className="flex items-center gap-2">
          <SegmentedTabs
            data-tour="calendar-views"
            label="Vue du calendrier"
            tabs={[
              { value: "day", label: "Jour" },
              { value: "week", label: "Semaine" },
              { value: "month", label: "Mois" },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigateMonth(-1)} aria-label="Précédent">
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="min-w-0 truncate text-center text-base font-semibold sm:text-lg">
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Aujourd&apos;hui
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)} aria-label="Suivant">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Month View */}
      {viewMode === "month" && (
        <Card>
          <CardContent className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-2">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-1 sm:py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {calendarDays.map(({ date, isCurrentMonth }, index) => {
                const dateStr = toLocalDateString(date)
                const events = getEventsForDate(date)
                const pinned = getPinnedForDate(date)
                // Deux lignes par case : d'abord les projets et tâches importants
                const shownPinned = pinned.slice(0, 2)
                const shownEvents = events.slice(0, 2 - shownPinned.length)
                const hidden = pinned.length + events.length - shownPinned.length - shownEvents.length
                const isToday = dateStr === today
                const isSelected = dateStr === selectedDate

                return (
                  <Dialog key={index} open={isDialogOpen && selectedDate === dateStr} onOpenChange={(open) => {
                    if (open) {
                      setSelectedDate(dateStr)
                    }
                    setIsDialogOpen(open)
                  }}>
                    <DialogTrigger asChild>
                      <button
                        onClick={() => setSelectedDate(dateStr)}
                        className={cn(
                          "@container min-w-0 min-h-16 sm:min-h-24 p-0.5 sm:p-1 text-left rounded-lg border transition-colors hover:bg-muted/50",
                          !isCurrentMonth && "opacity-40",
                          isToday && "border-primary bg-primary/5",
                          isSelected && "ring-2 ring-primary"
                        )}
                      >
                        <DayNumber day={date.getDate()} isToday={isToday} />
                        <div className="mt-0.5 sm:mt-1 space-y-0.5 hidden sm:block">
                          {shownPinned.map((item) => (
                            <PinnedChip key={item.key} item={item} />
                          ))}
                          {shownEvents.map((event) => (
                            <div
                              key={event.id}
                              className={cn(
                                "truncate rounded px-1 py-0.5 text-xs",
                                event.completed
                                  ? "bg-muted text-muted-foreground line-through"
                                  : getPriorityColor(event.priority)
                              )}
                            >
                              {event.title}
                            </div>
                          ))}
                          {hidden > 0 && (
                            <div className="text-xs text-muted-foreground px-1">
                              +{hidden} autres
                            </div>
                          )}
                        </div>
                        {/* Mobile event indicator */}
                        <div className="flex gap-0.5 sm:hidden mt-0.5">
                          {pinned.slice(0, 2).map((item) => (
                            <div key={item.key} className={cn("size-1.5 rounded-full", item.done ? "bg-muted-foreground" : "bg-warning")} />
                          ))}
                          {events.slice(0, 3 - Math.min(pinned.length, 2)).map((event) => (
                            <div
                              key={event.id}
                              className={cn(
                                "size-1.5 rounded-full",
                                event.completed
                                  ? "bg-muted-foreground"
                                  : event.priority === "high" ? "bg-destructive" 
                                  : event.priority === "medium" ? "bg-primary"
                                  : "bg-muted-foreground"
                              )}
                            />
                          ))}
                        </div>
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{formatDateFr(`${dateStr}T00:00`, "full")}</DialogTitle>
                        <DialogDescription>
                          Gérez les événements de cette journée
                        </DialogDescription>
                      </DialogHeader>

                      <PinnedList items={pinned} onOpen={() => setIsDialogOpen(false)} />

                      {/* Existing events */}
                      {events.length > 0 && (
                        <div className="space-y-2">
                          <Label>Événements</Label>
                          {events.map((event) => (
                            <div
                              key={event.id}
                              className="flex items-center justify-between rounded-lg border p-3"
                            >
                              <div className="flex items-center gap-2">
                                <button onClick={() => toggleEventComplete(event.id)}>
                                  {event.completed ? (
                                    <CheckCircle2 className="size-5 text-success" />
                                  ) : (
                                    <Clock className="size-5 text-muted-foreground" />
                                  )}
                                </button>
                                <span className={event.completed ? "line-through text-muted-foreground" : ""}>
                                  {event.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{event.priority}</Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteEvent(event.id)}
                                  className="text-destructive"
                                >
                                  Supprimer
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add new event */}
                      <div className="space-y-4 border-t pt-4">
                        <Label>Nouvel événement</Label>
                        <Input
                          placeholder="Titre de l'événement"
                          value={newEvent.title}
                          onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Heure de début</Label>
                            <Input
                              type="time"
                              value={newEvent.startTime || ""}
                              onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Heure de fin</Label>
                            <Input
                              type="time"
                              value={newEvent.endTime || ""}
                              onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Priorité</Label>
                          <Select
                            value={newEvent.priority}
                            onValueChange={(value: Priority) =>
                              setNewEvent({ ...newEvent, priority: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Basse</SelectItem>
                              <SelectItem value="medium">Moyenne</SelectItem>
                              <SelectItem value="high">Haute</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button onClick={handleAddEvent} disabled={!newEvent.title}>
                          <Plus className="size-4 mr-2" />
                          Ajouter
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week View */}
      {viewMode === "week" && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-2">
              {weekDays.map((date) => {
                const dateStr = toLocalDateString(date)
                const events = getEventsForDate(date)
                const pinned = getPinnedForDate(date)
                const isToday = dateStr === today

                return (
                  <Dialog key={dateStr} open={isDialogOpen && selectedDate === dateStr} onOpenChange={(open) => {
                    if (open) {
                      setSelectedDate(dateStr)
                    }
                    setIsDialogOpen(open)
                  }}>
                    <DialogTrigger asChild>
                      <div
                        className={cn(
                          "min-h-[200px] rounded-lg border p-2 cursor-pointer hover:bg-muted/50",
                          isToday && "border-primary bg-primary/5"
                        )}
                        onClick={() => setSelectedDate(dateStr)}
                      >
                        <div className="text-center mb-2">
                          <p className="text-xs text-muted-foreground">{DAYS[weekDays.indexOf(date)]}</p>
                          <p
                            className={cn(
                              "text-lg font-medium",
                              isToday && "text-primary"
                            )}
                          >
                            {date.getDate()}
                          </p>
                        </div>
                        <div className="space-y-1">
                          {pinned.map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              className="block w-full text-left"
                              onClick={(e) => {
                                e.stopPropagation()
                                openPinned(item)
                              }}
                            >
                              <PinnedChip item={item} className="p-2" />
                            </button>
                          ))}
                          {events.map((event) => (
                            <div
                              key={event.id}
                              className={cn(
                                "rounded p-2 text-xs",
                                event.completed
                                  ? "bg-muted text-muted-foreground line-through"
                                  : getPriorityColor(event.priority)
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleEventComplete(event.id)
                              }}
                            >
                              {event.startTime && (
                                <span className="font-medium">{event.startTime} - </span>
                              )}
                              {event.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{formatDateFr(`${dateStr}T00:00`, "full")}</DialogTitle>
                        <DialogDescription>
                          Gérez les événements de cette journée
                        </DialogDescription>
                      </DialogHeader>

                      <PinnedList items={pinned} onOpen={() => setIsDialogOpen(false)} />

                      {/* Existing events */}
                      {events.length > 0 && (
                        <div className="space-y-2">
                          <Label>Événements</Label>
                          {events.map((event) => (
                            <div
                              key={event.id}
                              className="flex items-center justify-between rounded-lg border p-3"
                            >
                              <div className="flex items-center gap-2">
                                <button onClick={() => toggleEventComplete(event.id)}>
                                  {event.completed ? (
                                    <CheckCircle2 className="size-5 text-success" />
                                  ) : (
                                    <Clock className="size-5 text-muted-foreground" />
                                  )}
                                </button>
                                <span className={event.completed ? "line-through text-muted-foreground" : ""}>
                                  {event.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{event.priority}</Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteEvent(event.id)}
                                  className="text-destructive"
                                >
                                  Supprimer
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add new event */}
                      <div className="space-y-4 border-t pt-4">
                        <Label>Nouvel événement</Label>
                        <Input
                          placeholder="Titre de l'événement"
                          value={newEvent.title}
                          onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Heure de début</Label>
                            <Input
                              type="time"
                              value={newEvent.startTime || ""}
                              onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Heure de fin</Label>
                            <Input
                              type="time"
                              value={newEvent.endTime || ""}
                              onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Priorité</Label>
                          <Select
                            value={newEvent.priority}
                            onValueChange={(value: Priority) => setNewEvent({ ...newEvent, priority: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Basse</SelectItem>
                              <SelectItem value="medium">Moyenne</SelectItem>
                              <SelectItem value="high">Haute</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button onClick={handleAddEvent} disabled={!newEvent.title}>
                          Ajouter l'événement
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day View */}
      {viewMode === "day" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{formatDateFr(currentDate, "full")}</CardTitle>
            <Dialog open={isDialogOpen && selectedDate === toLocalDateString(currentDate)} onOpenChange={(open) => {
              if (open) {
                setSelectedDate(toLocalDateString(currentDate))
              }
              setIsDialogOpen(open)
            }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setSelectedDate(toLocalDateString(currentDate))}>
                  <Plus className="size-4 mr-2" />
                  Ajouter un événement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvel événement</DialogTitle>
                  <DialogDescription>
                    Ajouter un événement pour le {formatDateFr(currentDate, "full")}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label>Titre</Label>
                    <Input
                      placeholder="Titre de l'événement"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Heure de début</Label>
                      <Input
                        type="time"
                        value={newEvent.startTime || ""}
                        onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Heure de fin</Label>
                      <Input
                        type="time"
                        value={newEvent.endTime || ""}
                        onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Priorité</Label>
                    <Select
                      value={newEvent.priority}
                      onValueChange={(value: Priority) => setNewEvent({ ...newEvent, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Basse</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button onClick={handleAddEvent} disabled={!newEvent.title}>
                    Ajouter l'événement
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-4">
            <PinnedList items={getPinnedForDate(currentDate)} />
            {(() => {
              const events = getEventsForDate(currentDate)
              if (events.length === 0) {
                return getPinnedForDate(currentDate).length > 0 ? null : (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun événement pour cette journée
                  </p>
                )
              }
              return events.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-4",
                    event.completed && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <button onClick={() => toggleEventComplete(event.id)}>
                      {event.completed ? (
                        <CheckCircle2 className="size-6 text-success" />
                      ) : (
                        <Clock className="size-6 text-muted-foreground" />
                      )}
                    </button>
                    <div>
                      <p className={cn("font-medium", event.completed && "line-through")}>
                        {event.title}
                      </p>
                      {event.startTime && (
                        <p className="text-sm text-muted-foreground">
                          {event.startTime} {event.endTime && `- ${event.endTime}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {event.priority === "high" ? "Haute" : event.priority === "medium" ? "Moyenne" : "Basse"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEvent(event.id)}
                      className="text-destructive"
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
