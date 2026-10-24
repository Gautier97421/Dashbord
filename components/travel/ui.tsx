"use client"

import type { ReactNode } from "react"
import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreDots } from "@/components/lottie"
import { cn } from "@/lib/utils"
import { PHASE_LABELS, type TripPhase } from "@/lib/travel/shared"

const PHASE_TONES: Record<TripPhase, string> = {
  upcoming: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  ongoing: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  past: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/15 text-destructive",
}

export function PhaseBadge({ phase }: { phase: TripPhase }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", PHASE_TONES[phase])}>{PHASE_LABELS[phase]}</span>
}

export const STATUS_TONES: Record<string, string> = {
  todo: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  planned: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  booked: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  visited: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-destructive/15 text-destructive",
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_TONES[status] ?? "bg-muted text-muted-foreground")}>{label}</span>
}

/** Bloc à bordure avec un titre et des actions à droite. */
export function Section({ title, icon, actions, children, className }: { title: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 space-y-3 rounded-xl border bg-card p-3 sm:p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className={cn("truncate text-lg font-semibold tabular-nums", tone === "good" && "text-emerald-600 dark:text-emerald-400", tone === "bad" && "text-destructive")}>{value}</p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Bouton « … » ouvrant un menu d'actions. */
export function ActionsMenu({ label, children, align = "end" }: { label: string; children: ReactNode; align?: "start" | "end" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 shrink-0 hover:bg-transparent hover:text-foreground dark:hover:bg-transparent" aria-label={label}>
          <MoreDots />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Texte copiable (numéro de réservation, code…). */
export function CopyText({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }, () => undefined)
      }
      className={cn("inline-flex max-w-full items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 font-mono text-xs", className)}
      title="Copier"
    >
      {copied ? <Check className="size-3 shrink-0 text-emerald-600" /> : <Copy className="size-3 shrink-0" />}
      <span className="truncate">{text}</span>
    </button>
  )
}

/** Barre de progression simple (0 → 1), rouge au-delà de 1. */
export function Bar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-all", value > 1 ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
        {label}
      </label>
      {children}
    </div>
  )
}
