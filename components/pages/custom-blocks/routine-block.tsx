'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, Trash2, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { genId } from '@/lib/custom-pages-context';
import { type PageBlock, type RoutineItem, type RoutineCategory } from '@/lib/types/custom-page';
import { cn } from '@/lib/utils';
import { StreakFlame } from "@/components/lottie"

const CATEGORIES: { value: RoutineCategory; label: string }[] = [
  { value: 'health', label: 'Santé' },
  { value: 'sport', label: 'Sport' },
  { value: 'mental', label: 'Mental' },
  { value: 'work', label: 'Travail' },
  { value: 'personal', label: 'Personnel' },
];
const PRIORITIES = [
  { value: 'low', label: 'Basse' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'high', label: 'Haute' },
] as const;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatFull(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); }
  catch { return dateStr; }
}

interface Props {
  block: PageBlock;
  onChange: (patch: Partial<PageBlock>) => void;
}

export function RoutineBlock({ block, onChange }: Props) {
  const items = block.routineItems || [];
  const log = block.log || {};
  const today = ymd(new Date());

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoutineItem | null>(null);
  const [draft, setDraft] = useState<Partial<RoutineItem>>({ text: '', category: 'personal', importance: 'medium' });
  const [selectedWeek, setSelectedWeek] = useState(0);

  const todayDone = log[today] || [];
  const progress = items.length > 0 ? Math.round((todayDone.length / items.length) * 100) : 0;

  // streak per item
  const streakFor = (itemId: string): number => {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const key = ymd(d);
      const done = (log[key] || []).includes(itemId);
      if (done) streak++;
      else if (key !== today) break;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  };

  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const current = new Date();
    current.setDate(current.getDate() + selectedWeek * 7);
    const dow = current.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    for (let i = 0; i < 7; i++) {
      const date = new Date(current);
      date.setDate(current.getDate() + diff + i);
      dates.push(date);
    }
    return dates;
  }, [selectedWeek]);

  const toggle = (itemId: string, date?: string) => {
    const key = date || today;
    const done = new Set(log[key] || []);
    if (done.has(itemId)) done.delete(itemId); else done.add(itemId);
    onChange({ log: { ...log, [key]: Array.from(done) } });
  };

  const saveAction = () => {
    if (!draft.text?.trim()) return;
    if (editing) {
      onChange({ routineItems: items.map((it) => it.id === editing.id ? { ...it, ...draft, text: draft.text!.trim() } as RoutineItem : it) });
    } else {
      onChange({ routineItems: [...items, { id: genId(), text: draft.text.trim(), category: draft.category, importance: draft.importance } as RoutineItem] });
    }
    setDraft({ text: '', category: 'personal', importance: 'medium' });
    setEditing(null);
    setIsDialogOpen(false);
  };

  const deleteItem = (id: string) => onChange({ routineItems: items.filter((it) => it.id !== id) });
  const openEdit = (item: RoutineItem) => {
    setEditing(item);
    setDraft({ text: item.text, category: item.category || 'personal', importance: item.importance || 'medium' });
    setIsDialogOpen(true);
  };

  const categoryColor = (c?: RoutineCategory) => {
    const colors: Record<RoutineCategory, string> = {
      health: 'bg-green-500/10 text-green-600 border-green-500/30',
      sport: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
      mental: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
      work: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
      personal: 'bg-pink-500/10 text-pink-600 border-pink-500/30',
    };
    return colors[c || 'personal'];
  };

  const longestStreak = items.length ? Math.max(...items.map((it) => streakFor(it.id)), 0) : 0;
  const activeStreaks = items.filter((it) => streakFor(it.id) > 0).length;
  const totalCompleted = Object.values(log).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="space-y-6">
      {/* Add action button */}
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditing(null); setDraft({ text: '', category: 'personal', importance: 'medium' }); }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto"><Plus className="size-4 mr-2" /> Ajouter une action</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier l'action" : 'Nouvelle action'}</DialogTitle>
              <DialogDescription>{editing ? 'Modifiez les détails de cette action' : 'Ajoutez une nouvelle action à votre routine'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom de l'action</Label>
                <Input placeholder="Ex : Méditation 10 min" value={draft.text || ''} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={draft.category} onValueChange={(v: RoutineCategory) => setDraft({ ...draft, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Importance</Label>
                <Select value={draft.importance} onValueChange={(v: 'low' | 'medium' | 'high') => setDraft({ ...draft, importance: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
              <Button onClick={saveAction} disabled={!draft.text?.trim()}>{editing ? 'Enregistrer' : 'Ajouter'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Today's progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="size-5" /> Aujourd'hui</CardTitle>
          <CardDescription>{todayDone.length} / {items.length} actions complétées</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-3 mb-4 sm:mb-6" />
          {items.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30"
                 onClick={() => setIsDialogOpen(true)}>
              <Plus className="size-6 mx-auto mb-1" /> Ajoute ta première action
            </div>
          ) : (
            <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 @4xl/main:grid-cols-3">
              {items.map((action) => {
                const isCompleted = todayDone.includes(action.id);
                const streak = streakFor(action.id);
                return (
                  <div key={action.id} className={cn('flex items-center justify-between rounded-lg border p-4 transition-all', isCompleted && 'bg-green-500/5 border-green-500/30')}>
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox checked={isCompleted} onCheckedChange={() => toggle(action.id)} className="size-5" />
                      <div className="min-w-0">
                        <p className={cn('font-medium truncate', isCompleted && 'text-muted-foreground line-through')}>{action.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={categoryColor(action.category)}>{CATEGORIES.find((c) => c.value === action.category)?.label || 'Personnel'}</Badge>
                          {streak > 0 && <div className="flex items-center gap-1 text-orange-500"><StreakFlame className="size-4" /><span className="text-xs font-medium">{streak}j</span></div>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(action)}><Edit className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => deleteItem(action.id)}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History + stats */}
      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">Calendrier</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Historique de la semaine</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setSelectedWeek((p) => p - 1)}><ChevronLeft className="size-4" /></Button>
                <span className="text-xs text-muted-foreground min-w-[110px] text-center">
                  {selectedWeek === 0 ? 'Cette semaine' : selectedWeek === -1 ? 'Semaine dernière' : `Sem. ${selectedWeek}`}
                </span>
                <Button variant="outline" size="icon" onClick={() => setSelectedWeek((p) => Math.min(p + 1, 0))} disabled={selectedWeek >= 0}><ChevronRight className="size-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-2 font-medium text-muted-foreground text-sm">Action</th>
                      {weekDates.map((date) => {
                        const dateStr = ymd(date);
                        const isToday = dateStr === today;
                        return (
                          <th key={dateStr} className={cn('p-2 text-center font-medium min-w-[44px]', isToday && 'text-primary')}>
                            <div className="text-xs text-muted-foreground">{['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()]}</div>
                            <div className={cn('text-sm', isToday && 'text-primary font-bold')}>{date.getDate()}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((action) => (
                      <tr key={action.id} className="border-t">
                        <td className="p-2"><span className="text-sm font-medium">{action.text}</span></td>
                        {weekDates.map((date) => {
                          const dateStr = ymd(date);
                          const isLogged = (log[dateStr] || []).includes(action.id);
                          const isPast = dateStr < today;
                          const isToday = dateStr === today;
                          return (
                            <td key={dateStr} className="p-2 text-center">
                              <button
                                onClick={() => toggle(action.id, dateStr)}
                                disabled={dateStr > today}
                                className={cn('size-7 rounded-full flex items-center justify-center mx-auto transition-colors text-sm',
                                  isLogged && 'bg-green-500 text-white',
                                  !isLogged && isPast && 'bg-destructive/20 text-destructive',
                                  !isLogged && isToday && 'bg-muted hover:bg-muted/80',
                                  dateStr > today && 'opacity-30 cursor-not-allowed')}
                              >
                                {isLogged ? '✓' : isPast ? '✗' : '○'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={8} className="text-center text-sm text-muted-foreground py-6">Aucune action.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader><CardTitle className="text-base">Statistiques</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-2 @4xl/main:grid-cols-4">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{totalCompleted}</p>
                  <p className="text-sm text-muted-foreground">Actions complétées</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-green-500">{longestStreak}</p>
                  <p className="text-sm text-muted-foreground">Plus longue série</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-orange-500">{activeStreaks}</p>
                  <p className="text-sm text-muted-foreground">Séries actives</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold">{items.length}</p>
                  <p className="text-sm text-muted-foreground">Actions au total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
