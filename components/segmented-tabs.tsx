"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SegmentedTab<T extends string> {
  value: T
  label: ReactNode
  icon?: LucideIcon
  // Pastille (compteur) à droite du libellé ; rien si 0
  badge?: number
  badgeTone?: "default" | "alert"
}

/**
 * Choix entre plusieurs vues, au style du choix Matinale / Du soir de la page Routine : rail gris,
 * onglet actif sur le fond de la page avec une ombre. Trop d'onglets pour la largeur : le rail défile,
 * un fondu signale les onglets cachés et l'onglet actif reste visible.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  stretch = false,
  className,
  ...rest
}: {
  tabs: SegmentedTab<T>[]
  value: T
  onChange: (value: T) => void
  // Nom du groupe pour les lecteurs d'écran
  label: string
  // Onglets étirés sur toute la largeur (peu d'onglets, petits écrans)
  stretch?: boolean
  className?: string
  "data-tour"?: string
}) {
  const railRef = useRef<HTMLDivElement>(null)
  // Onglets cachés à gauche / à droite du rail
  const [hidden, setHidden] = useState({ left: false, right: false })

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const update = () =>
      setHidden({ left: rail.scrollLeft > 2, right: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2 })
    update()
    rail.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(rail)
    return () => {
      rail.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [])

  // L'onglet actif reste visible (choisi ailleurs, ou au retour sur la page)
  useEffect(() => {
    const rail = railRef.current
    const active = rail?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!rail || !active || rail.scrollWidth <= rail.clientWidth) return
    const left = active.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft
    if (left < rail.scrollLeft || left + active.offsetWidth > rail.scrollLeft + rail.clientWidth) {
      rail.scrollTo({ left: Math.max(0, left - 24), behavior: "smooth" })
    }
  }, [value])

  const fade = 24
  const mask =
    hidden.left || hidden.right
      ? `linear-gradient(to right, ${hidden.left ? "transparent" : "black"}, black ${fade}px, black calc(100% - ${fade}px), ${hidden.right ? "transparent" : "black"})`
      : undefined

  return (
    <div
      ref={railRef}
      className={cn("max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", stretch ? "w-full" : "w-fit", className)}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      data-tour={rest["data-tour"]}
    >
      <div role="tablist" aria-label={label} className={cn("inline-flex min-w-max gap-1 rounded-lg bg-muted p-1", stretch && "w-full")}>
        {tabs.map(({ value: v, label: text, icon: Icon, badge, badgeTone = "default" }) => {
          const active = v === value
          return (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(v)}
              className={cn(
                "flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4",
                stretch && "flex-1",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {Icon && <Icon className="size-4" />}
              {text}
              {!!badge && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                    badgeTone === "alert" ? "bg-destructive text-white" : "bg-muted-foreground/15 text-muted-foreground"
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
