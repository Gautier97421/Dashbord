'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useLiveRefresh } from '@/lib/live-sync';
import { cn } from '@/lib/utils';
import { monthlyCost, parseAmount, rollForward, type BillingFrequency } from '@/lib/subscription-billing';
import { Plus, Trash2, Pencil, Mail, CreditCard, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Search, FileText } from 'lucide-react';

interface Subscription {
  id: string;
  service: string;
  status: 'active' | 'trial' | 'cancelled' | 'unknown';
  amount: string | null;
  nextBillingDate: string | null;
  frequency: 'weekly' | 'monthly' | 'yearly' | 'other' | null;
  notes: string | null;
  lastAction: string | null;
  lastEmailId: string | null;
  // Liens Gmail : mail qui justifie le statut, et mail (ou facture jointe) d'où vient le prix
  emailUrl: string | null;
  invoiceUrl: string | null;
}

// Mail qui justifie le statut, selon le dernier événement détecté
const ACTION_EMAIL_LABELS: Record<string, string> = {
  payment: 'Mail du dernier paiement',
  renewal: 'Mail de renouvellement',
  new: 'Mail de souscription',
  cancellation: 'Mail de résiliation',
  trial_ending: "Mail de fin d'essai",
  price_increase: 'Mail de hausse de prix',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  trial: 'Essai',
  cancelled: 'Résilié',
  unknown: 'Inconnu',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-700 dark:text-green-400',
  trial: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  cancelled: 'bg-red-500/15 text-red-700 dark:text-red-400',
  unknown: 'bg-muted text-muted-foreground',
};

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  yearly: 'Annuel',
  other: 'Autre',
};

const EMPTY_FORM = {
  service: '',
  amount: '',
  nextBillingDate: '',
  frequency: '' as '' | 'weekly' | 'monthly' | 'yearly' | 'other',
  status: 'active' as 'active' | 'trial' | 'cancelled' | 'unknown',
  notes: '',
};

type SortKey = 'service' | 'status' | 'amount' | 'frequency' | 'next' | 'monthly';
type StatusFilter = 'all' | 'active' | 'trial' | 'cancelled';

const DAY_MS = 24 * 60 * 60 * 1000;
// Prélèvement imminent : mis en évidence dans le tableau
const SOON_DAYS = 7;

const formatEuro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

// Saisie du prix : chiffres et un seul séparateur décimal (virgule), 2 décimales au plus
function sanitizeAmountInput(value: string): string {
  const cleaned = value.replace(/\./g, ',').replace(/[^\d,]/g, '');
  const [whole, ...rest] = cleaned.split(',');
  return rest.length ? `${whole},${rest.join('').slice(0, 2)}` : whole;
}

// "9,99" (saisie) -> "9,99 €" (enregistré) ; vide si pas de montant
function amountFromInput(value: string): string | null {
  const n = parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? formatEuro(n) : null;
}

// Prochain prélèvement affiché : une date passée est avancée selon la fréquence (ex: mensuel)
function nextBilling(sub: Subscription): Date | null {
  if (!sub.nextBillingDate || sub.status === 'cancelled') return null;
  const freq = sub.frequency && sub.frequency !== 'other' ? (sub.frequency as BillingFrequency) : null;
  return rollForward(new Date(sub.nextBillingDate), freq);
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / DAY_MS);
}

function relativeDays(days: number): string {
  if (days < 0) return 'passé';
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  return `dans ${days} j`;
}

// embedded : affichée comme sous-partie de la page Budgets (titre plus discret)
export function SubscriptionsPage({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toDelete, setToDelete] = useState<Subscription | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'next', dir: 'asc' });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadSubscriptions();
  }, []);

  // silent : rafraîchissement automatique, sans écran de chargement ni message d'erreur
  const loadSubscriptions = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/subscriptions');
      if (!res.ok) throw new Error();
      setSubscriptions(await res.json());
    } catch {
      if (!silent) toast({ title: 'Erreur', description: 'Impossible de charger les abonnements', variant: 'destructive' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useLiveRefresh(() => loadSubscriptions(true));

  const scanEmails = async () => {
    try {
      setScanning(true);
      const res = await fetch('/api/subscriptions/scan', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erreur');
      const extras = [
        data.ignoredPromos ? `${data.ignoredPromos} pub(s) ignorée(s)` : '',
        data.removed ? `${data.removed} faux abonnement(s) retiré(s)` : '',
      ].filter(Boolean).join(', ');
      toast({
        title: 'Scan terminé',
        description: `${data.found} abonnement(s) payé(s) détecté(s) sur ${data.scanned} mails analysés (6 derniers mois)${extras ? ` — ${extras}` : ''}.`,
      });
      loadSubscriptions();
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Le scan a échoué',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (sub: Subscription) => {
    setEditingId(sub.id);
    setForm({
      service: sub.service,
      amount: parseAmount(sub.amount)?.toFixed(2).replace('.', ',') ?? '',
      nextBillingDate: sub.nextBillingDate ? sub.nextBillingDate.slice(0, 10) : '',
      frequency: sub.frequency || '',
      status: sub.status,
      notes: sub.notes || '',
    });
    setShowForm(true);
  };

  const saveSubscription = async () => {
    if (!form.service.trim()) return;
    try {
      const url = editingId ? `/api/subscriptions/${editingId}` : '/api/subscriptions';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: form.service,
          amount: amountFromInput(form.amount),
          nextBillingDate: form.nextBillingDate || null,
          frequency: form.frequency || null,
          status: form.status,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      loadSubscriptions();
      toast({ title: editingId ? 'Modifié' : 'Ajouté', description: `Abonnement ${form.service} enregistré` });
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : "Impossible d'enregistrer", variant: 'destructive' });
    }
  };

  const deleteSubscription = async (id: string) => {
    setSubscriptions((subs) => subs.filter((s) => s.id !== id));
    try {
      await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
    } catch {
      loadSubscriptions();
    }
  };

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = subscriptions.filter(
      (s) => (statusFilter === 'all' || s.status === statusFilter) && (!q || s.service.toLowerCase().includes(q))
    );
    const value = (s: Subscription): string | number | null => {
      switch (sort.key) {
        case 'service': return s.service.toLowerCase();
        case 'status': return STATUS_LABELS[s.status] || s.status;
        case 'amount': return parseAmount(s.amount);
        case 'frequency': return s.frequency ? FREQUENCY_LABELS[s.frequency] : null;
        case 'next': return nextBilling(s)?.getTime() ?? null;
        case 'monthly': return s.status === 'cancelled' ? null : monthlyCost(s.amount, s.frequency);
      }
    };
    // Valeurs manquantes toujours en bas, quel que soit le sens du tri
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [subscriptions, statusFilter, query, sort]);

  const activeSubs = subscriptions.filter((s) => s.status === 'active' || s.status === 'trial');
  const monthlyTotal = activeSubs.reduce((sum, s) => sum + (monthlyCost(s.amount, s.frequency) ?? 0), 0);
  const missingCost = activeSubs.filter((s) => monthlyCost(s.amount, s.frequency) == null).length;
  const upcoming = activeSubs
    .map((s) => ({ sub: s, date: nextBilling(s) }))
    .filter((x): x is { sub: Subscription; date: Date } => !!x.date)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  const visibleMonthly = rows
    .filter((s) => s.status !== 'cancelled')
    .reduce((sum, s) => sum + (monthlyCost(s.amount, s.frequency) ?? 0), 0);

  const counts: Record<StatusFilter, number> = {
    all: subscriptions.length,
    active: subscriptions.filter((s) => s.status === 'active').length,
    trial: subscriptions.filter((s) => s.status === 'trial').length,
    cancelled: subscriptions.filter((s) => s.status === 'cancelled').length,
  };

  const SortHeader = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className} aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn('inline-flex items-center gap-1 hover:text-foreground', className?.includes('text-right') && 'flex-row-reverse')}
      >
        {children}
        {sort.key === k ? (
          sort.dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
        ) : (
          <ArrowUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );

  const empty = <span className="text-muted-foreground">—</span>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {embedded ? (
            <h2 className="text-lg font-semibold">Abonnements</h2>
          ) : (
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Suivi des abonnements</h1>
          )}
          <p className="text-sm text-muted-foreground">Détectés automatiquement dans vos mails ou ajoutés manuellement</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={scanEmails} disabled={scanning} variant="outline" size="sm">
            {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Scanner mes emails
          </Button>
          <Button data-tour="subscriptions-add" onClick={openAddForm} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Résumé */}
      {subscriptions.length > 0 && (
        <div className="grid grid-cols-2 @4xl/main:grid-cols-4 gap-2 sm:gap-3">
          <Card className="py-3 gap-0">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">Abonnements actifs</p>
              <p className="text-xl font-bold">{activeSubs.length}</p>
            </CardContent>
          </Card>
          <Card className="py-3 gap-0">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">Coût mensuel</p>
              <p className="text-xl font-bold">{formatEuro(monthlyTotal)}</p>
              {missingCost > 0 && <p className="text-[11px] text-muted-foreground">{missingCost} sans prix ou fréquence</p>}
            </CardContent>
          </Card>
          <Card className="py-3 gap-0">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">Coût annuel</p>
              <p className="text-xl font-bold">{formatEuro(monthlyTotal * 12)}</p>
            </CardContent>
          </Card>
          <Card className="py-3 gap-0">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">Prochain prélèvement</p>
              {upcoming ? (
                <>
                  <p className="text-xl font-bold truncate">{upcoming.sub.service}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {upcoming.date.toLocaleDateString('fr-FR')} · {relativeDays(daysUntil(upcoming.date))}
                    {upcoming.sub.amount && ` · ${upcoming.sub.amount}`}
                  </p>
                </>
              ) : (
                <p className="text-xl font-bold text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tableau */}
      {loading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Chargement...</CardContent></Card>
      ) : subscriptions.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <CreditCard className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">Aucun abonnement suivi</p>
            <p className="text-sm text-muted-foreground">Cliquez sur « Scanner mes emails » pour une détection automatique, ou ajoutez-en un manuellement.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0 gap-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border-b">
            <div className="flex flex-wrap gap-1">
              {(['all', 'active', 'trial', 'cancelled'] as StatusFilter[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={statusFilter === f ? 'default' : 'ghost'}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setStatusFilter(f)}
                >
                  {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : f === 'trial' ? 'Essais' : 'Résiliés'} ({counts[f]})
                </Button>
              ))}
            </div>
            <div className="relative sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className="h-8 pl-8 text-sm" />
            </div>
          </div>

          <Table className="text-sm">
            <TableHeader className="bg-muted/40">
              <TableRow>
                <SortHeader k="service" className="sticky left-0 z-10 bg-muted min-w-40">Service</SortHeader>
                <SortHeader k="status">Statut</SortHeader>
                <SortHeader k="amount" className="text-right">Prix</SortHeader>
                <SortHeader k="frequency">Fréquence</SortHeader>
                <SortHeader k="next">Prochain prélèvement</SortHeader>
                <SortHeader k="monthly" className="text-right">Coût / mois</SortHeader>
                <TableHead>Mails</TableHead>
                <TableHead className="w-20"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((sub) => {
                const next = nextBilling(sub);
                const days = next ? daysUntil(next) : null;
                const soon = days != null && days >= 0 && days <= SOON_DAYS;
                const perMonth = sub.status === 'cancelled' ? null : monthlyCost(sub.amount, sub.frequency);
                return (
                  <TableRow key={sub.id} className={cn('group', sub.status === 'cancelled' && 'opacity-60')}>
                    <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-muted font-medium max-w-56">
                      <div className="truncate">{sub.service}</div>
                      {sub.notes && <div className="text-xs text-muted-foreground font-normal truncate">{sub.notes}</div>}
                    </TableCell>
                    <TableCell>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap', STATUS_COLORS[sub.status])}>
                        {STATUS_LABELS[sub.status] || sub.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{sub.amount || empty}</TableCell>
                    <TableCell>{sub.frequency ? FREQUENCY_LABELS[sub.frequency] : empty}</TableCell>
                    <TableCell className="tabular-nums">
                      {next ? (
                        <span className={cn(soon && 'font-medium text-amber-600 dark:text-amber-400')}>
                          {next.toLocaleDateString('fr-FR')}
                          <span className="text-xs text-muted-foreground ml-1.5">{relativeDays(days!)}</span>
                        </span>
                      ) : (
                        empty
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{perMonth != null ? formatEuro(perMonth) : empty}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {sub.emailUrl || sub.invoiceUrl ? (
                        <div className="flex items-center gap-0.5">
                          {sub.emailUrl && (
                            <Button asChild size="icon" variant="ghost" className="size-7">
                              <a
                                href={sub.emailUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={ACTION_EMAIL_LABELS[sub.lastAction || ''] || 'Voir le mail'}
                                aria-label={`${ACTION_EMAIL_LABELS[sub.lastAction || ''] || 'Voir le mail'} — ${sub.service}`}
                              >
                                <Mail className="size-3.5" />
                              </a>
                            </Button>
                          )}
                          {sub.invoiceUrl && sub.invoiceUrl !== sub.emailUrl && (
                            <Button asChild size="icon" variant="ghost" className="size-7">
                              <a
                                href={sub.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Mail d'où vient le prix"
                                aria-label={`Mail d'où vient le prix — ${sub.service}`}
                              >
                                <FileText className="size-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      ) : (
                        '✍️ Manuel'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Button onClick={() => openEditForm(sub)} size="icon" variant="ghost" className="size-7" aria-label={`Modifier ${sub.service}`}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button onClick={() => setToDelete(sub)} size="icon" variant="ghost" className="size-7 text-destructive" aria-label={`Supprimer ${sub.service}`}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    Aucun abonnement ne correspond
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="sticky left-0 z-10 bg-muted font-semibold">Total ({rows.filter((s) => s.status !== 'cancelled').length} en cours)</TableCell>
                <TableCell colSpan={4} />
                <TableCell className="text-right font-semibold tabular-nums">{formatEuro(visibleMonthly)}</TableCell>
                <TableCell colSpan={2} className="text-xs text-muted-foreground whitespace-nowrap">
                  soit {formatEuro(visibleMonthly * 12)} / an
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      )}

      {/* Formulaire d'ajout / modification */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-[90vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier l'abonnement" : 'Nouvel abonnement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Service *</Label>
              <Input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="ex: Netflix" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sub-amount">Prix</Label>
                <div className="relative">
                  <Input
                    id="sub-amount"
                    inputMode="decimal"
                    value={form.amount}
                    // Toujours en euros : seuls les chiffres et une virgule sont acceptés
                    onChange={(e) => setForm({ ...form, amount: sanitizeAmountInput(e.target.value) })}
                    placeholder="9,99"
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">€</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prochain prélèvement</Label>
                <Input type="date" value={form.nextBillingDate} onChange={(e) => setForm({ ...form, nextBillingDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fréquence</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as any })}>
                  <SelectTrigger><SelectValue placeholder="Non renseignée" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button onClick={saveSubscription}>{editingId ? 'Enregistrer' : 'Ajouter'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression */}
      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet abonnement ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {toDelete?.service} » ne sera plus suivi
              {toDelete?.lastEmailId ? ' et les prochains scans de mails ne le recréeront pas' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (toDelete) deleteSubscription(toDelete.id); setToDelete(null); }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SubscriptionsPage;
