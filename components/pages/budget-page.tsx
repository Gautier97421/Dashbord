"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, CreditCard, Pencil, Plus, Settings2, Tags, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DeleteButton } from "@/components/delete-button"
import { SegmentedTabs } from "@/components/segmented-tabs"
import { useToast } from "@/hooks/use-toast"
import { useLiveRefresh } from "@/lib/live-sync"
import { cn } from "@/lib/utils"
import { dayKey, daysBetween, formatDay } from "@/lib/projects/core"
import { formatMoney, parseMoney, periodRange, shiftPeriod, subscriptionsForPeriod, type BudgetPeriod } from "@/lib/budget"
import { SubscriptionsPage } from "./subscriptions-page"

type Tab = "budget" | "subscriptions"

interface Settings {
  period: BudgetPeriod
  amount: number | null
  includeSubscriptions: boolean
}

interface Category {
  id: string
  name: string
  limitAmount: number | null
  color: string | null
}

interface Entry {
  id: string
  label: string
  amount: number
  kind: "expense" | "income"
  date: string
  categoryId: string | null
  notes: string | null
}

interface BudgetData {
  settings: Settings
  categories: Category[]
  entries: Entry[]
  subscriptions: { monthlyTotal: number; items: { id: string; service: string; monthly: number }[] }
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"]
const STARTER_CATEGORIES = [
  { name: "Courses", color: "#22c55e" },
  { name: "Logement", color: "#3b82f6" },
  { name: "Transport", color: "#f97316" },
  { name: "Restaurants", color: "#ec4899" },
  { name: "Loisirs", color: "#8b5cf6" },
  { name: "Santé", color: "#14b8a6" },
]
const NO_CATEGORY = "none"

const periodLabel = (period: BudgetPeriod, from: string, to: string) => {
  if (period === "weekly") return `Semaine du ${formatDay(from)} au ${formatDay(to, true)}`
  const [y, m] = from.split("-").map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

async function send(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Erreur")
  return data
}

/** Page "Gérer ses budgets" : budget (mensuel ou hebdomadaire) et abonnements. */
export function BudgetPage({ initialTab = "budget" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Gérer ses budgets</h1>
        <p className="text-sm text-muted-foreground">Ton budget du mois ou de la semaine, tes dépenses et tes abonnements</p>
      </div>
      <SegmentedTabs
        data-tour="budget-tabs"
        label="Sections du budget"
        value={tab}
        onChange={setTab}
        stretch
        className="sm:w-fit"
        tabs={[
          { value: "budget", label: "Budget", icon: Wallet },
          { value: "subscriptions", label: "Abonnements", icon: CreditCard },
        ]}
      />
      {tab === "budget" ? <BudgetView onOpenSubscriptions={() => setTab("subscriptions")} /> : <SubscriptionsPage embedded />}
    </div>
  )
}

function BudgetView({ onOpenSubscriptions }: { onOpenSubscriptions: () => void }) {
  const { toast } = useToast()
  const today = dayKey()
  const [period, setPeriod] = useState<BudgetPeriod>("monthly")
  const [anchor, setAnchor] = useState(today)
  const [data, setData] = useState<BudgetData | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | "new" | null>(null)
  const range = periodRange(period, anchor)
  // La période enregistrée n'est reprise qu'au premier chargement : ensuite, c'est le choix à l'écran qui compte
  const periodLoaded = useRef(false)

  const load = useCallback(
    async (silent = false) => {
      try {
        const next: BudgetData = await send("GET", `/api/budget?from=${range.from}&to=${range.to}`)
        setData(next)
        if (!periodLoaded.current) {
          periodLoaded.current = true
          setPeriod(next.settings.period)
        }
      } catch {
        if (!silent) toast({ title: "Budget indisponible", description: "Réessaie dans un instant.", variant: "destructive" })
      }
    },
    [range.from, range.to, toast]
  )

  useEffect(() => {
    load()
  }, [load])
  useLiveRefresh(() => load(true))

  const fail = (error: unknown) => toast({ title: "Action impossible", description: error instanceof Error ? error.message : undefined, variant: "destructive" })

  const changePeriod = async (next: BudgetPeriod) => {
    setPeriod(next)
    setAnchor(today)
    try {
      await send("PUT", "/api/budget", { period: next })
    } catch (e) {
      fail(e)
    }
  }

  const stats = useMemo(() => {
    if (!data) return null
    const expenses = data.entries.filter((e) => e.kind === "expense")
    const incomes = data.entries.filter((e) => e.kind === "income")
    const subscriptions = data.settings.includeSubscriptions ? subscriptionsForPeriod(data.subscriptions.monthlyTotal, period) : 0
    const spentByCategory = new Map<string | null, number>()
    for (const e of expenses) {
      const key = e.categoryId && data.categories.some((c) => c.id === e.categoryId) ? e.categoryId : null
      spentByCategory.set(key, (spentByCategory.get(key) || 0) + e.amount)
    }
    const categoryLimits = data.categories.reduce((sum, c) => sum + (c.limitAmount || 0), 0)
    const budget = data.settings.amount ?? (categoryLimits > 0 ? categoryLimits : null)
    const spent = expenses.reduce((sum, e) => sum + e.amount, 0) + subscriptions
    const income = incomes.reduce((sum, e) => sum + e.amount, 0)
    // Période en cours : part du temps écoulé, pour comparer au rythme des dépenses
    const current = today >= range.from && today <= range.to
    const elapsed = current ? (daysBetween(range.from, today) + 1) / range.days : today > range.to ? 1 : 0
    const daysLeft = current ? daysBetween(today, range.to) + 1 : 0
    return { subscriptions, spentByCategory, budget, spent, income, elapsed, daysLeft, current }
  }, [data, period, range.from, range.to, range.days, today])

  if (!data || !stats) return <p className="py-12 text-center text-sm text-muted-foreground">Chargement…</p>

  const remaining = stats.budget != null ? stats.budget - stats.spent : null
  const usedPct = stats.budget ? Math.min(100, (stats.spent / stats.budget) * 100) : 0
  const ahead = stats.budget != null && stats.current && stats.spent > stats.budget * stats.elapsed

  return (
    <div className="space-y-4">
      {/* Période */}
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={period} onValueChange={(v) => v && changePeriod(v as BudgetPeriod)}>
          <ToggleGroupItem value="monthly">Mensuel</ToggleGroupItem>
          <ToggleGroupItem value="weekly">Hebdomadaire</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex min-w-0 max-w-full items-center gap-1">
          <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => setAnchor(shiftPeriod(period, range.from, -1))} aria-label="Période précédente">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-0 truncate px-1 text-center text-sm font-medium @2xl/main:min-w-40">{periodLabel(period, range.from, range.to)}</span>
          <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => setAnchor(shiftPeriod(period, range.from, 1))} aria-label="Période suivante">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {!stats.current && (
          <Button variant="outline" size="sm" onClick={() => setAnchor(today)}>
            Aujourd&apos;hui
          </Button>
        )}
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="size-4" />
          Réglages
        </Button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 @4xl/main:grid-cols-4">
        <SummaryCard
          label={period === "weekly" ? "Budget de la semaine" : "Budget du mois"}
          value={stats.budget != null ? formatMoney(stats.budget) : "—"}
          hint={data.settings.amount == null && stats.budget != null ? "Somme des catégories" : stats.budget == null ? "À définir dans Réglages" : undefined}
          onClick={() => setSettingsOpen(true)}
        />
        <SummaryCard
          label="Dépensé"
          value={formatMoney(stats.spent)}
          hint={stats.subscriptions > 0 ? `dont ${formatMoney(stats.subscriptions)} d'abonnements` : undefined}
        />
        <SummaryCard
          label="Reste"
          value={remaining != null ? formatMoney(remaining) : "—"}
          tone={remaining != null && remaining < 0 ? "text-destructive" : remaining != null ? "text-success" : undefined}
          hint={remaining != null && stats.current && stats.daysLeft > 0 && remaining > 0 ? `≈ ${formatMoney(remaining / stats.daysLeft)} par jour` : undefined}
        />
        <SummaryCard
          label="Revenus"
          value={formatMoney(stats.income)}
          hint={stats.income > 0 ? `Solde : ${formatMoney(stats.income - stats.spent)}` : "Ajoute tes revenus pour voir ton solde"}
        />
      </div>

      {stats.budget != null && (
        <div className="space-y-1.5">
          <div className="relative">
            <Progress value={usedPct} className={cn("h-3", remaining != null && remaining < 0 && "[&>[data-slot=progress-indicator]]:bg-destructive")} />
            {/* Repère du temps écoulé dans la période */}
            {stats.current && <span className="absolute -top-1 h-5 w-0.5 rounded bg-foreground/60" style={{ left: `${stats.elapsed * 100}%` }} title="Aujourd'hui" />}
          </div>
          <p className={cn("text-xs", ahead ? "text-warning" : "text-muted-foreground")}>
            {Math.round(usedPct)} % du budget utilisé
            {stats.current && (ahead ? " · tu dépenses plus vite que prévu" : " · dans les clous")}
          </p>
        </div>
      )}

      <div className="grid gap-4 @4xl/main:grid-cols-5">
        <div className="space-y-4 @4xl/main:col-span-3">
          <EntryForm categories={data.categories} range={range} today={today} onSaved={load} />
          <Card className="gap-0 py-0">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-base">Opérations</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              {data.entries.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucune dépense ni revenu sur cette période</p>
              ) : (
                <EntryList entries={data.entries} categories={data.categories} onEdit={setEditingEntry} onDeleted={load} />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="gap-0 py-0 @4xl/main:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tags className="size-4 text-muted-foreground" />
              Catégories
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setEditingCategory("new")}>
              <Plus className="size-4" />
              Catégorie
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3">
            {data.categories.length === 0 && (
              <div className="space-y-2 rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                <p>Range tes dépenses par catégorie, avec un plafond pour chacune.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      for (const c of STARTER_CATEGORIES) await send("POST", "/api/budget/categories", c)
                      load()
                    } catch (e) {
                      fail(e)
                    }
                  }}
                >
                  Créer des catégories de base
                </Button>
              </div>
            )}
            {data.categories.map((c) => {
              const spent = stats.spentByCategory.get(c.id) || 0
              const over = c.limitAmount != null && spent > c.limitAmount
              return (
                <div key={c.id} className="group rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color || "#64748b" }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                    <span className={cn("shrink-0 text-xs tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {formatMoney(spent)}
                      {c.limitAmount != null && ` / ${formatMoney(c.limitAmount)}`}
                    </span>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => setEditingCategory(c)} aria-label={`Modifier ${c.name}`}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <DeleteButton
                      label="Supprimer la catégorie"
                      onDelete={async () => {
                        try {
                          await send("DELETE", `/api/budget/categories?id=${c.id}`)
                          load()
                        } catch (e) {
                          fail(e)
                        }
                      }}
                      confirm={{ title: `Supprimer la catégorie « ${c.name} » ?`, description: "Ses dépenses sont gardées, sans catégorie." }}
                    />
                  </div>
                  {c.limitAmount != null && c.limitAmount > 0 && (
                    <Progress
                      value={Math.min(100, (spent / c.limitAmount) * 100)}
                      className={cn("mt-2 h-1.5", over && "[&>[data-slot=progress-indicator]]:bg-destructive")}
                    />
                  )}
                </div>
              )
            })}
            {(stats.spentByCategory.get(null) || 0) > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed p-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">Sans catégorie</span>
                <span className="text-xs tabular-nums text-muted-foreground">{formatMoney(stats.spentByCategory.get(null) || 0)}</span>
              </div>
            )}
            {data.settings.includeSubscriptions && data.subscriptions.items.length > 0 && (
              <button type="button" onClick={onOpenSubscriptions} className="flex w-full items-center gap-2 rounded-lg border bg-muted/30 p-2.5 text-left text-sm hover:bg-muted/50">
                <CreditCard className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Abonnements</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {data.subscriptions.items.length} actif{data.subscriptions.items.length > 1 ? "s" : ""} · {data.subscriptions.items.slice(0, 3).map((s) => s.service).join(", ")}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatMoney(stats.subscriptions)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={data.settings}
        period={period}
        monthlySubscriptions={data.subscriptions.monthlyTotal}
        onSaved={load}
      />
      <EntryDialog entry={editingEntry} categories={data.categories} onClose={() => setEditingEntry(null)} onSaved={load} />
      <CategoryDialog category={editingCategory} period={period} onClose={() => setEditingCategory(null)} onSaved={load} />
    </div>
  )
}

function SummaryCard({ label, value, hint, tone, onClick }: { label: string; value: string; hint?: string; tone?: string; onClick?: () => void }) {
  const content = (
    <>
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p className={cn("mt-1 truncate text-xl font-bold tabular-nums sm:text-2xl", tone)}>{value}</p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </>
  )
  const className = "rounded-xl border bg-card p-3 text-left sm:p-4"
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(className, "transition-colors hover:bg-muted/40")}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}

function EntryForm({ categories, range, today, onSaved }: { categories: Category[]; range: { from: string; to: string }; today: string; onSaved: () => void }) {
  const { toast } = useToast()
  const defaultDate = today >= range.from && today <= range.to ? today : range.from
  const [kind, setKind] = useState<"expense" | "income">("expense")
  const [label, setLabel] = useState("")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState(NO_CATEGORY)
  const [date, setDate] = useState(defaultDate)
  const [saving, setSaving] = useState(false)

  useEffect(() => setDate(defaultDate), [defaultDate])

  const submit = async () => {
    const value = parseMoney(amount)
    if (!label.trim() || value == null || value <= 0) return
    setSaving(true)
    try {
      await send("POST", "/api/budget/entries", { kind, label: label.trim(), amount: value, date, categoryId: categoryId === NO_CATEGORY ? null : categoryId })
      setLabel("")
      setAmount("")
      onSaved()
    } catch (e) {
      toast({ title: "Opération non ajoutée", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <ToggleGroup type="single" variant="outline" size="sm" value={kind} onValueChange={(v) => v && setKind(v as "expense" | "income")}>
          <ToggleGroupItem value="expense">
            <TrendingDown className="size-4" />
            Dépense
          </ToggleGroupItem>
          <ToggleGroupItem value="income">
            <TrendingUp className="size-4" />
            Revenu
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_7rem]">
          <Input
            className="col-span-2 sm:col-span-1"
            placeholder={kind === "expense" ? "Ex : Courses du marché" : "Ex : Salaire"}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
            aria-label="Libellé"
          />
          <Input
            inputMode="decimal"
            placeholder="0,00 €"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
            aria-label="Montant"
          />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value || defaultDate)} aria-label="Date" className="sm:hidden" />
        </div>
        <div className="flex flex-wrap gap-2">
          {kind === "expense" && (
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-[min(12rem,60vw)]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>Sans catégorie</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color || "#64748b" }} />
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value || defaultDate)} aria-label="Date" className="hidden h-8 w-auto sm:block" />
          <Button size="sm" className="ml-auto" onClick={submit} disabled={saving || !label.trim() || !(parseMoney(amount) ?? 0)}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function EntryList({ entries, categories, onEdit, onDeleted }: { entries: Entry[]; categories: Category[]; onEdit: (e: Entry) => void; onDeleted: () => void }) {
  const byDate = new Map<string, Entry[]>()
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) || []), e])
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="space-y-3">
      {[...byDate.entries()].map(([date, list]) => (
        <section key={date}>
          <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{formatDay(date, true)}</h3>
          <ul>
            {list.map((e) => {
              const category = e.categoryId ? categoryById.get(e.categoryId) : undefined
              return (
                <li key={e.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: e.kind === "income" ? "#22c55e" : category?.color || "#94a3b8" }} />
                  <button type="button" onClick={() => onEdit(e)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm">{e.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{e.kind === "income" ? "Revenu" : category?.name || "Sans catégorie"}</span>
                  </button>
                  <span className={cn("shrink-0 text-sm font-medium tabular-nums", e.kind === "income" ? "text-success" : "text-foreground")}>
                    {e.kind === "income" ? "+" : "−"}
                    {formatMoney(e.amount)}
                  </span>
                  <DeleteButton
                    label="Supprimer l'opération"
                    onDelete={async () => {
                      await send("DELETE", `/api/budget/entries?id=${e.id}`).catch(() => {})
                      onDeleted()
                    }}
                    confirm={{ title: `Supprimer « ${e.label} » ?`, description: `${formatMoney(e.amount)} le ${formatDay(e.date, true)}` }}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function EntryDialog({ entry, categories, onClose, onSaved }: { entry: Entry | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({ label: "", amount: "", date: "", categoryId: NO_CATEGORY, kind: "expense" as Entry["kind"], notes: "" })

  useEffect(() => {
    if (entry) {
      setForm({
        label: entry.label,
        amount: entry.amount.toFixed(2).replace(".", ","),
        date: entry.date,
        categoryId: entry.categoryId || NO_CATEGORY,
        kind: entry.kind,
        notes: entry.notes || "",
      })
    }
  }, [entry])

  const save = async () => {
    if (!entry) return
    try {
      await send("PUT", "/api/budget/entries", {
        id: entry.id,
        label: form.label,
        amount: parseMoney(form.amount),
        date: form.date,
        kind: form.kind,
        categoryId: form.categoryId === NO_CATEGORY ? null : form.categoryId,
        notes: form.notes,
      })
      onClose()
      onSaved()
    } catch (e) {
      toast({ title: "Modification impossible", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    }
  }

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[92vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;opération</DialogTitle>
          <DialogDescription>{form.kind === "income" ? "Revenu" : "Dépense"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <ToggleGroup type="single" variant="outline" size="sm" value={form.kind} onValueChange={(v) => v && setForm({ ...form, kind: v as Entry["kind"] })}>
            <ToggleGroupItem value="expense">Dépense</ToggleGroupItem>
            <ToggleGroupItem value="income">Revenu</ToggleGroupItem>
          </ToggleGroup>
          <div className="space-y-1.5">
            <Label htmlFor="entry-label">Libellé</Label>
            <Input id="entry-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry-amount">Montant</Label>
              <Input id="entry-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d,.]/g, "") })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-date">Date</Label>
              <Input id="entry-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          {form.kind === "expense" && (
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Sans catégorie</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color || "#64748b" }} />
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="entry-notes">Note</Label>
            <Input id="entry-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={!form.label.trim() || !(parseMoney(form.amount) ?? 0) || !form.date}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryDialog({ category, period, onClose, onSaved }: { category: Category | "new" | null; period: BudgetPeriod; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [limit, setLimit] = useState("")
  const [color, setColor] = useState(COLORS[0])
  const isNew = category === "new"

  useEffect(() => {
    if (!category) return
    if (category === "new") {
      setName("")
      setLimit("")
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)])
    } else {
      setName(category.name)
      setLimit(category.limitAmount != null ? category.limitAmount.toFixed(2).replace(".", ",") : "")
      setColor(category.color || COLORS[0])
    }
  }, [category])

  const save = async () => {
    if (!category || !name.trim()) return
    const body = { name: name.trim(), limitAmount: limit.trim() ? parseMoney(limit) : null, color }
    try {
      if (category === "new") await send("POST", "/api/budget/categories", body)
      else await send("PUT", "/api/budget/categories", { id: category.id, ...body })
      onClose()
      onSaved()
    } catch (e) {
      toast({ title: "Catégorie non enregistrée", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    }
  }

  return (
    <Dialog open={!!category} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[92vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nouvelle catégorie" : "Modifier la catégorie"}</DialogTitle>
          <DialogDescription>Plafond {period === "weekly" ? "par semaine" : "par mois"}, facultatif.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Nom</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Courses" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-limit">Plafond</Label>
            <Input id="cat-limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d,.]/g, ""))} placeholder="Sans plafond" />
          </div>
          <div className="space-y-1.5">
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn("size-7 rounded-full border-2 transition-transform hover:scale-110", color === c ? "border-foreground" : "border-transparent")}
                  style={{ backgroundColor: c }}
                  aria-label={`Couleur ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={!name.trim()}>
            {isNew ? "Créer" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SettingsDialog({
  open,
  onOpenChange,
  settings,
  period,
  monthlySubscriptions,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  period: BudgetPeriod
  monthlySubscriptions: number
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [amount, setAmount] = useState("")
  const [includeSubscriptions, setIncludeSubscriptions] = useState(true)

  useEffect(() => {
    if (!open) return
    setAmount(settings.amount != null ? settings.amount.toFixed(2).replace(".", ",") : "")
    setIncludeSubscriptions(settings.includeSubscriptions)
  }, [open, settings])

  const save = async () => {
    try {
      await send("PUT", "/api/budget", { amount: amount.trim() ? parseMoney(amount) : null, includeSubscriptions })
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast({ title: "Réglages non enregistrés", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Réglages du budget</DialogTitle>
          <DialogDescription>Budget {period === "weekly" ? "hebdomadaire" : "mensuel"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Budget total {period === "weekly" ? "par semaine" : "par mois"}</Label>
            <Input id="budget-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))} placeholder="Vide : somme des plafonds des catégories" />
          </div>
          <Label className="flex items-start gap-2 font-normal">
            <Switch checked={includeSubscriptions} onCheckedChange={setIncludeSubscriptions} />
            <span>
              Compter les abonnements dans les dépenses
              <span className="block text-xs text-muted-foreground">
                {formatMoney(subscriptionsForPeriod(monthlySubscriptions, period))} {period === "weekly" ? "par semaine" : "par mois"} d&apos;après la page Abonnements
              </span>
            </span>
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
