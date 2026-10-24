'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2 } from 'lucide-react';
import { genId } from '@/lib/custom-pages-context';
import { type PageBlock, type CalendarEvent } from '@/lib/types/custom-page';
import { cn } from '@/lib/utils';
import { DayNumber } from '@/components/month-calendar';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

type Priority = 'low' | 'medium' | 'high';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr(): string { return ymd(new Date()); }
function formatFull(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

interface Props {
  block: PageBlock;
  onChange: (patch: Partial<PageBlock>) => void;
}

export function CalendarBlock({ block, onChange }: Props) {
  const events = block.events || [];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({ title: '', priority: 'medium' });

  const today = todayStr();

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;
    for (let i = startDay - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    for (let i = 1; i <= lastDay.getDate(); i++) days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    return days;
  }, [currentDate]);

  const eventsForDate = (date: Date) => events.filter((e) => e.date === ymd(date));
  const navigateMonth = (dir: number) => setCurrentDate((p) => new Date(p.getFullYear(), p.getMonth() + dir, 1));

  const addEvent = () => {
    if (!newEvent.title || !selectedDate) return;
    const ev: CalendarEvent = {
      id: genId(), date: selectedDate, title: newEvent.title,
      startTime: newEvent.startTime, endTime: newEvent.endTime,
      priority: (newEvent.priority as Priority) || 'medium', completed: false,
    };
    onChange({ events: [...events, ev] });
    setNewEvent({ title: '', priority: 'medium' });
    setIsDialogOpen(false);
  };
  const toggleComplete = (id: string) => onChange({ events: events.map((e) => e.id === id ? { ...e, completed: !e.completed } : e) });
  const deleteEvent = (id: string) => onChange({ events: events.filter((e) => e.id !== id) });

  const priorityColor = (p?: Priority) => {
    switch (p) {
      case 'high': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'low': return 'bg-muted text-muted-foreground border-muted';
      default: return 'bg-primary/20 text-primary border-primary/30';
    }
  };

  const dayDialog = (dateStr: string, dayEvents: CalendarEvent[]) => (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{formatFull(dateStr)}</DialogTitle>
        <DialogDescription>Gérez les événements de cette journée</DialogDescription>
      </DialogHeader>

      {dayEvents.length > 0 && (
        <div className="space-y-2">
          <Label>Événements</Label>
          {dayEvents.map((event) => (
            <div key={event.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <button onClick={() => toggleComplete(event.id)}>
                  {event.completed ? <CheckCircle2 className="size-5 text-green-500" /> : <Clock className="size-5 text-muted-foreground" />}
                </button>
                <span className={event.completed ? 'line-through text-muted-foreground' : ''}>{event.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{event.priority}</Badge>
                <Button variant="ghost" size="sm" onClick={() => deleteEvent(event.id)} className="text-destructive">Supprimer</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4 border-t pt-4">
        <Label>Nouvel événement</Label>
        <Input placeholder="Titre de l'événement" value={newEvent.title || ''} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Heure de début</Label>
            <Input type="time" value={newEvent.startTime || ''} onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })} />
          </div>
          <div>
            <Label>Heure de fin</Label>
            <Input type="time" value={newEvent.endTime || ''} onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Priorité</Label>
          <Select value={newEvent.priority} onValueChange={(v: Priority) => setNewEvent({ ...newEvent, priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Basse</SelectItem>
              <SelectItem value="medium">Moyenne</SelectItem>
              <SelectItem value="high">Haute</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={addEvent} disabled={!newEvent.title}><Plus className="size-4 mr-2" /> Ajouter</Button>
      </DialogFooter>
    </DialogContent>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigateMonth(-1)} aria-label="Mois précédent"><ChevronLeft className="size-4" /></Button>
        <h2 className="min-w-0 truncate text-center text-base font-semibold sm:text-lg">{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Aujourd&apos;hui</Button>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)} aria-label="Mois suivant"><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-2 sm:p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-2">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-1 sm:py-2">{day}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {calendarDays.map(({ date, isCurrentMonth }, index) => {
              const dateStr = ymd(date);
              const dayEvents = eventsForDate(date);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              return (
                <Dialog key={index} open={isDialogOpen && selectedDate === dateStr} onOpenChange={(open) => {
                  if (open) { setSelectedDate(dateStr); setNewEvent({ title: '', priority: 'medium' }); }
                  setIsDialogOpen(open);
                }}>
                  <DialogTrigger asChild>
                    <button
                      onClick={() => setSelectedDate(dateStr)}
                      className={cn(
                        '@container min-w-0 min-h-16 sm:min-h-24 p-0.5 sm:p-1 text-left rounded-lg border transition-colors hover:bg-muted/50',
                        !isCurrentMonth && 'opacity-40',
                        isToday && 'border-primary bg-primary/5',
                        isSelected && 'ring-2 ring-primary'
                      )}
                    >
                      <DayNumber day={date.getDate()} isToday={isToday} />
                      <div className="mt-0.5 sm:mt-1 space-y-0.5 hidden sm:block">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div key={event.id} className={cn('truncate rounded px-1 py-0.5 text-xs', event.completed ? 'bg-muted text-muted-foreground line-through' : priorityColor(event.priority))}>
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && <div className="text-xs text-muted-foreground px-1">+{dayEvents.length - 2} autres</div>}
                      </div>
                      <div className="flex gap-0.5 sm:hidden mt-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div key={event.id} className={cn('size-1.5 rounded-full', event.completed ? 'bg-muted-foreground' : event.priority === 'high' ? 'bg-destructive' : event.priority === 'low' ? 'bg-muted-foreground' : 'bg-primary')} />
                        ))}
                      </div>
                    </button>
                  </DialogTrigger>
                  {dayDialog(dateStr, dayEvents)}
                </Dialog>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
