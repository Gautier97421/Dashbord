"use client"

import { useMemo, useState } from "react"
import { ArrowRight, CalendarDays, Loader2, Pencil, PieChart, Plus, RefreshCw, Settings2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DeleteButton } from "@/components/delete-button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  budgetStats,
  expenseTotal,
  formatDay,
  formatMoney,
  labelOf,
  settleUp,
  tripDays,
  type TripExpense,
} from "@/lib/travel/shared"
import { send, useTravel, useTrip } from "./context"
import { TripFiles } from "./files"
import { ActionsMenu, Bar, Empty, Field, Section, Stat, StatusBadge } from "./ui"

type Filter = "all" | "planned" | "booked" | "paid"
const NONE = "none"

export function BudgetView() {
  const trip = useTrip()
  const { offlineSince } = useTravel()
  const [filter, setFilter] = useState<Filter>("all")
  const [editing, setEditing] = useState<TripExpense | "new" | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const stats = useMemo(() => budgetStats(trip), [trip])
  const settle = useMemo(() => settleUp(trip), [trip])
  const money = (n: number) => formatMoney(n, trip.currency)
  const nameOf = (id: string | null) => trip.travelers.find((t) => t.id === id)?.name ?? "?"
  const expenses = trip.expenses.filter((e) => filter === "all" || e.status === filter)
  const days = tripDays(trip)
  const maxDay = Math.max(1, ...days.map((d) => stats.byDay.get(d) || 0))
  const categories = [...stats.byCategory].sort((a, b) => b[1].spent - a[1].spent)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-4">
        <Stat label="Budget prévu" value={stats.budget != null ? money(stats.budget) : "—"} hint={stats.budget == null ? "à définir dans Réglages" : undefined} />
        <Stat label="Engagé" value={money(stats.committed)} hint={`dont ${money(stats.planned)} prévus`} />
        <Stat label="Payé" value={money(stats.paid)} hint={stats.booked ? `${money(stats.booked)} réservés à payer` : undefined} />
        <Stat
          label="Restant estimé"
          value={stats.remaining != null ? money(stats.remaining) : "—"}
          tone={stats.remaining == null ? undefined : stats.remaining < 0 ? "bad" : "good"}
          hint={stats.remaining != null && stats.remaining < 0 ? "budget dépassé" : undefined}
        />
      </div>
      {stats.budget != null && <Bar value={stats.budget ? stats.committed / stats.budget : 0} />}

      <div className="grid gap-4 @4xl/main:grid-cols-2">
        <Section
          title="Par catégorie"
          icon={<PieChart className="size-4" />}
          actions={
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} disabled={!!offlineSince}>
              <Settings2 className="size-4" />
              Réglages
            </Button>
          }
        >
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune dépense pour l&apos;instant.</p>
          ) : (
            <ul className="space-y-2.5">
              {categories.map(([cat, { spent, limit }]) => (
                <li key={cat} className="space-y-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{labelOf(EXPENSE_CATEGORIES, cat)}</span>
                    <span className={cn("shrink-0 tabular-nums", limit != null && spent > limit && "font-medium text-destructive")}>
                      {money(spent)}
                      {limit != null && <span className="text-muted-foreground"> / {money(limit)}</span>}
                    </span>
                  </div>
                  {limit != null && <Bar value={limit ? spent / limit : 0} />}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {trip.travelers.length >= 2 ? (
          <Section title="Voyageurs et remboursements" icon={<Users className="size-4" />}>
            <ul className="space-y-1.5">
              {trip.travelers.map((t) => {
                const v = settle.balances.get(t.id) || 0
                return (
                  <li key={t.id} className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{t.name}</span>
                    <span className={cn("shrink-0 tabular-nums", v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-destructive" : "text-muted-foreground")}>
                      {v > 0 ? "+" : ""}
                      {money(v)}
                    </span>
                  </li>
                )
              })}
            </ul>
            {settle.transfers.length > 0 ? (
              <div className="space-y-1 border-t pt-2">
                <p className="text-xs font-medium text-muted-foreground">Pour équilibrer</p>
                {settle.transfers.map((tr, i) => (
                  <p key={i} className="flex flex-wrap items-center gap-1 text-sm">
                    <span className="font-medium">{nameOf(tr.from)}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{nameOf(tr.to)}</span>
                    <span className="ml-auto tabular-nums">{money(tr.amount)}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Les comptes sont équilibrés (dépenses réservées et payées, avec un payeur).</p>
            )}
          </Section>
        ) : (
          <Section title="Dépenses sur place par jour" icon={<CalendarDays className="size-4" />}>
            <DailyBars days={days} byDay={stats.byDay} max={maxDay} money={money} />
          </Section>
        )}
      </div>

      {trip.travelers.length >= 2 && (
        <Section title="Dépenses sur place par jour" icon={<CalendarDays className="size-4" />}>
          <DailyBars days={days} byDay={stats.byDay} max={maxDay} money={money} />
        </Section>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} aria-label="Dépenses affichées">
            <ToggleGroupItem value="all">Toutes</ToggleGroupItem>
            <ToggleGroupItem value="planned">Prévues</ToggleGroupItem>
            <ToggleGroupItem value="booked">Réservées</ToggleGroupItem>
            <ToggleGroupItem value="paid">Payées</ToggleGroupItem>
          </ToggleGroup>
          <Button size="sm" className="ml-auto" onClick={() => setEditing("new")} disabled={!!offlineSince}>
            <Plus className="size-4" />
            Ajouter une dépense
          </Button>
        </div>
        {trip.bookings.some((b) => b.cost != null && b.status !== "cancelled") && (
          <p className="text-xs text-muted-foreground">Les coûts des réservations comptent dans le budget, sauf si une dépense y est liée (pas de double compte).</p>
        )}
        {expenses.length === 0 ? (
          <Empty>Aucune dépense. Note les dépenses prévues avant le départ, puis celles faites sur place.</Empty>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {expenses.map((e) => (
              <ExpenseRow key={e.id} expense={e} onEdit={() => setEditing(e)} nameOf={nameOf} />
            ))}
          </ul>
        )}
      </div>

      {editing && <ExpenseDialog expense={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {settingsOpen && <BudgetSettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function DailyBars({ days, byDay, max, money }: { days: string[]; byDay: Map<string, number>; max: number; money: (n: number) => string }) {
  const shown = days.filter((d) => byDay.get(d))
  if (!shown.length) return <p className="text-sm text-muted-foreground">Les dépenses payées pendant le voyage s&apos;affichent ici, jour par jour.</p>
  return (
    <ul className="space-y-1.5">
      {shown.map((d) => (
        <li key={d} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
          <span className="truncate text-muted-foreground">{formatDay(d)}</span>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${((byDay.get(d) || 0) / max) * 100}%` }} />
          </div>
          <span className="tabular-nums">{money(byDay.get(d) || 0)}</span>
        </li>
      ))}
    </ul>
  )
}

function ExpenseRow({ expense: e, onEdit, nameOf }: { expense: TripExpense; onEdit: () => void; nameOf: (id: string | null) => string }) {
  const trip = useTrip()
  const { removeItem, offlineSince } = useTravel()
  const files = trip.attachments.filter((a) => a.tripItemId === e.id).length
  const foreign = e.currency !== trip.currency
  return (
    <li className="flex items-start gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{e.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDay(e.date)} · {labelOf(EXPENSE_CATEGORIES, e.category)}
          {e.paidBy ? ` · payé par ${nameOf(e.paidBy)}` : ""}
          {e.paymentMethod ? ` · ${e.paymentMethod}` : ""}
          {files ? ` · ${files} justificatif${files > 1 ? "s" : ""}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">{formatMoney(expenseTotal(e), trip.currency)}</p>
        {(foreign || e.fees > 0) && (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {foreign ? formatMoney(e.amount, e.currency) : ""}
            {e.fees > 0 ? `${foreign ? " + " : ""}${formatMoney(e.fees, trip.currency)} frais` : ""}
          </p>
        )}
      </div>
      <StatusBadge status={e.status} label={labelOf(EXPENSE_STATUSES, e.status)} />
      <ActionsMenu label={`Actions pour ${e.label}`}>
        <DropdownMenuItem onClick={onEdit} disabled={!!offlineSince}>
          <Pencil className="size-4" />
          Modifier et justificatifs
        </DropdownMenuItem>
      </ActionsMenu>
      {!offlineSince && <DeleteButton label="Supprimer la dépense" onDelete={() => removeItem("expenses", e.id).then(() => undefined)} confirm={{ title: `Supprimer « ${e.label} » ?`, destructive: true }} />}
    </li>
  )
}

// ─── Dépense ─────────────────────────────────────────────────────────────────

function ExpenseDialog({ expense, onClose }: { expense: TripExpense | null; onClose: () => void }) {
  const trip = useTrip()
  const { addItem, updateItem, today } = useTravel()
  const { toast } = useToast()
  const defaultDay = today >= trip.startDate && today <= trip.endDate ? today : today < trip.startDate ? today : trip.endDate
  const [form, setForm] = useState({
    date: expense?.date ?? defaultDay,
    label: expense?.label ?? "",
    category: expense?.category ?? "food",
    amount: expense ? String(expense.amount).replace(".", ",") : "",
    currency: expense?.currency ?? trip.currency,
    rate: expense ? String(expense.rate).replace(".", ",") : "1",
    fees: expense?.fees ? String(expense.fees).replace(".", ",") : "",
    status: expense?.status ?? (today >= trip.startDate ? "paid" : "planned"),
    paymentMethod: expense?.paymentMethod ?? NONE,
    paidBy: expense?.paidBy ?? NONE,
    bookingId: expense?.bookingId ?? NONE,
    notes: expense?.notes ?? "",
  })
  const [splitWith, setSplitWith] = useState<string[]>(expense?.splitWith ?? [])
  const [saving, setSaving] = useState(false)
  const [fetchingRate, setFetchingRate] = useState(false)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const foreign = form.currency !== trip.currency
  const num = (s: string) => parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0
  const converted = num(form.amount) * (foreign ? num(form.rate) || 1 : 1) + num(form.fees)

  const fetchRate = async () => {
    setFetchingRate(true)
    try {
      const { rate, date } = await send<{ rate: number; date: string | null }>("GET", `/api/trips/rate?from=${form.currency}&to=${trip.currency}`)
      set({ rate: String(Math.round(rate * 1e6) / 1e6).replace(".", ",") })
      toast({ title: "Taux mis à jour", description: date ? `Taux de la BCE du ${new Date(date).toLocaleDateString("fr-FR")}` : undefined })
    } catch (e) {
      toast({ title: "Taux indisponible", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    } finally {
      setFetchingRate(false)
    }
  }

  const save = async () => {
    if (!form.label.trim() || !(num(form.amount) > 0)) return
    setSaving(true)
    const payload = {
      ...form,
      label: form.label.trim(),
      rate: foreign ? form.rate : 1,
      fees: form.fees.trim() || 0,
      paymentMethod: form.paymentMethod === NONE ? null : form.paymentMethod,
      paidBy: form.paidBy === NONE ? null : form.paidBy,
      bookingId: form.bookingId === NONE ? null : form.bookingId,
      notes: form.notes.trim() || null,
      splitWith,
    }
    const saved = expense ? await updateItem("expenses", expense.id, payload) : await addItem("expenses", payload)
    setSaving(false)
    if (saved) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
          <DialogDescription>Convertie dans la devise du voyage ({trip.currency}).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Libellé" htmlFor="ex-label" className="col-span-2">
            <Input id="ex-label" value={form.label} onChange={(e) => set({ label: e.target.value })} placeholder="Dîner, taxi, musée…" autoFocus />
          </Field>
          <Field label="Date" htmlFor="ex-date">
            <Input id="ex-date" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Catégorie">
            <Select value={form.category} onValueChange={(category) => set({ category })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Montant" htmlFor="ex-amount">
            <Input id="ex-amount" inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0,00" />
          </Field>
          <Field label="Devise">
            <Select value={form.currency} onValueChange={(currency) => set({ currency, rate: currency === trip.currency ? "1" : form.rate })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {foreign && (
            <Field label={`Taux (1 ${form.currency} = ? ${trip.currency})`} htmlFor="ex-rate" className="col-span-2">
              <div className="flex gap-2">
                <Input id="ex-rate" inputMode="decimal" value={form.rate} onChange={(e) => set({ rate: e.target.value })} />
                <Button type="button" variant="outline" onClick={fetchRate} disabled={fetchingRate} className="shrink-0">
                  {fetchingRate ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Taux du jour
                </Button>
              </div>
            </Field>
          )}
          <Field label={`Frais bancaires (${trip.currency})`} htmlFor="ex-fees">
            <Input id="ex-fees" inputMode="decimal" value={form.fees} onChange={(e) => set({ fees: e.target.value })} placeholder="0" />
          </Field>
          <Field label="État">
            <Select value={form.status} onValueChange={(status) => set({ status })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Moyen de paiement">
            <Select value={form.paymentMethod} onValueChange={(paymentMethod) => set({ paymentMethod })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Non précisé</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {trip.bookings.length > 0 && (
            <Field label="Réservation liée">
              <Select value={form.bookingId} onValueChange={(bookingId) => set({ bookingId })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucune</SelectItem>
                  {trip.bookings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {trip.travelers.length > 0 && (
            <>
              <Field label="Payé par">
                <Select value={form.paidBy} onValueChange={(paidBy) => set({ paidBy })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Non précisé</SelectItem>
                    {trip.travelers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Partagée entre (vide = tout le monde)" className="col-span-2">
                <div className="flex flex-wrap gap-3">
                  {trip.travelers.map((t) => (
                    <label key={t.id} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={splitWith.includes(t.id)}
                        onCheckedChange={(v) => setSplitWith((list) => (v === true ? [...list, t.id] : list.filter((id) => id !== t.id)))}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </Field>
            </>
          )}
          <Field label="Notes" htmlFor="ex-notes" className="col-span-2">
            <Textarea id="ex-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          {expense ? (
            <Field label="Justificatifs" className="col-span-2">
              <TripFiles itemId={expense.id} compact />
            </Field>
          ) : (
            <p className="col-span-2 text-xs text-muted-foreground">Les justificatifs se joignent une fois la dépense enregistrée (menu « … » → Modifier).</p>
          )}
        </div>
        <DialogFooter className="items-center">
          {num(form.amount) > 0 && (foreign || num(form.fees) > 0) && (
            <span className="mr-auto text-sm text-muted-foreground">
              Soit <span className="font-medium text-foreground">{formatMoney(Math.round(converted * 100) / 100, trip.currency)}</span>
            </span>
          )}
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !form.label.trim() || !(num(form.amount) > 0)}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {expense ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Réglages du budget ──────────────────────────────────────────────────────

function BudgetSettingsDialog({ onClose }: { onClose: () => void }) {
  const trip = useTrip()
  const { saveTrip } = useTravel()
  const [budget, setBudget] = useState(trip.budget != null ? String(trip.budget).replace(".", ",") : "")
  const [limits, setLimits] = useState<Record<string, string>>(
    Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, trip.categoryBudgets[c.value] != null ? String(trip.categoryBudgets[c.value]).replace(".", ",") : ""]))
  )
  const [saving, setSaving] = useState(false)
  const sum = Object.values(limits).reduce((s, v) => s + (parseFloat(v.replace(",", ".")) || 0), 0)

  const save = async () => {
    setSaving(true)
    const categoryBudgets = Object.fromEntries(Object.entries(limits).filter(([, v]) => v.trim()).map(([k, v]) => [k, v]))
    const saved = await saveTrip(trip.id, { budget: budget.trim() || null, categoryBudgets })
    setSaving(false)
    if (saved) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Budget du voyage</DialogTitle>
          <DialogDescription>Un budget global et, si tu veux, un plafond par catégorie ({trip.currency}).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Budget global" htmlFor="bg-total">
            <Input id="bg-total" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={sum ? String(sum) : "Facultatif"} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <Field key={c.value} label={c.label} htmlFor={`bg-${c.value}`}>
                <Input id={`bg-${c.value}`} inputMode="decimal" value={limits[c.value]} onChange={(e) => setLimits((l) => ({ ...l, [c.value]: e.target.value }))} />
              </Field>
            ))}
          </div>
          {sum > 0 && <p className="text-xs text-muted-foreground">Total des plafonds : {formatMoney(sum, trip.currency)}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
