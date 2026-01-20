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
import { ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2 } from "lucide-react"
import { useApp } from "@/lib/store-api"
import { generateId, formatDateFr, getToday } from "@/lib/helpers"
import type { CalendarEvent, Priority } from "@/lib/types"
import { cn } from "@/lib/utils"

type ViewMode = "day" | "week" | "month"

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
    const dateStr = date.toISOString().split("T")[0]
    return (state.calendarEvents || []).filter((e) => e.date === dateStr)
  }

  const navigateMonth = (direction: number) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (viewMode === "month") {
        newDate.setMonth(prev.getMonth() + direction)
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendrier</h1>
          <p className="text-muted-foreground">Planifiez vos événements et tâches</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode(mode)}
                className="rounded-none first:rounded-l-lg last:rounded-r-lg"
              >
                {mode === "day" ? "Jour" : mode === "week" ? "Semaine" : "Mois"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Month View */}
      {viewMode === "month" && (
        <Card>
          <CardContent className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(({ date, isCurrentMonth }, index) => {
                const dateStr = date.toISOString().split("T")[0]
                const events = getEventsForDate(date)
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
                          "min-h-24 p-1 text-left rounded-lg border transition-colors hover:bg-muted/50",
                          !isCurrentMonth && "opacity-40",
                          isToday && "border-primary bg-primary/5",
                          isSelected && "ring-2 ring-primary"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex size-6 items-center justify-center rounded-full text-sm",
                            isToday && "bg-primary text-primary-foreground font-medium"
                          )}
                        >
                          {date.getDate()}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {events.slice(0, 2).map((event) => (
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
                          {events.length > 2 && (
                            <div className="text-xs text-muted-foreground px-1">
                              +{events.length - 2} autres
                            </div>
                          )}
                        </div>
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{formatDateFr(dateStr, "full")}</DialogTitle>
                        <DialogDescription>
                          Gérez les événements de cette journée
                        </DialogDescription>
                      </DialogHeader>

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
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((date) => {
                const dateStr = date.toISOString().split("T")[0]
                const events = getEventsForDate(date)
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
                        <DialogTitle>{formatDateFr(dateStr, "full")}</DialogTitle>
                        <DialogDescription>
                          Gérez les événements de cette journée
                        </DialogDescription>
                      </DialogHeader>

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
            <Dialog open={isDialogOpen && selectedDate === currentDate.toISOString().split("T")[0]} onOpenChange={(open) => {
              if (open) {
                setSelectedDate(currentDate.toISOString().split("T")[0])
              }
              setIsDialogOpen(open)
            }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setSelectedDate(currentDate.toISOString().split("T")[0])}>
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
            {(() => {
              const events = getEventsForDate(currentDate)
              if (events.length === 0) {
                return (
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
