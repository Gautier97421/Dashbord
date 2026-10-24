"use client"

import { useEffect, useRef, type MouseEvent } from "react"
import type { AnimationItem } from "lottie-web"
import rawAnimation from "@/public/animations/utilisees/Delete animation.json"
import { cn } from "@/lib/utils"
import { useConfirm, type ConfirmOptions } from "@/components/confirm-provider"

// Le gris foncé de l'animation serait invisible en mode sombre : il est remplacé par du noir pur,
// que le CSS (.lottie-delete dans globals.css) remplace à son tour par la couleur du texte du bouton
const isDarkGray = (c: unknown) =>
  Array.isArray(c) && c.length >= 3 && Math.abs(c[0] - 0.161) < 0.02 && Math.abs(c[1] - 0.176) < 0.02 && Math.abs(c[2] - 0.196) < 0.02
function recolor(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(recolor)
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node)) {
      out[key] = key === "c" && value && typeof value === "object" && isDarkGray((value as { k?: unknown }).k) ? { ...value, k: [0, 0, 0, 1] } : recolor(value)
    }
    return out
  }
  return node
}
const animationData = recolor(rawAnimation)

// Lecteur Lottie "léger" (rendu SVG, sans expressions donc sans eval), chargé une seule fois et à la demande
let lottiePromise: Promise<typeof import("lottie-web/build/player/lottie_light").default> | null = null
const loadLottie = () => (lottiePromise ??= import("lottie-web/build/player/lottie_light").then((m) => m.default))

// Partie animée de l'animation (le couvercle s'ouvre, la poubelle passe au rouge) ; avant : image immobile
const PLAY_FROM = 18
// Survol : passage au rouge, puis retour à l'état de repos au départ de la souris, à la même vitesse
const SPEED_IN = 1
const SPEED_OUT = 1

interface DeleteButtonProps {
  // Suppression, après confirmation
  onDelete: () => void | Promise<void>
  // Texte du bouton pour les lecteurs d'écran et l'infobulle (ex. "Supprimer la tâche")
  label: string
  // Fenêtre d'avertissement contre les clics par erreur ; false : suppression directe
  confirm?: ConfirmOptions | false
  size?: "sm" | "md"
  className?: string
}

/** Corbeille animée : l'animation joue au survol, et un clic demande confirmation avant de supprimer. */
export function DeleteButton({ onDelete, label, confirm, size = "sm", className }: DeleteButtonProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const askConfirm = useConfirm()

  useEffect(() => {
    let disposed = false
    loadLottie().then((lottie) => {
      if (disposed || !containerRef.current) return
      const anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: structuredClone(animationData),
      })
      animRef.current = anim
    })
    return () => {
      disposed = true
      animRef.current?.destroy()
      animRef.current = null
    }
  }, [])

  // Survol : l'animation va jusqu'au bout et reste sur sa dernière image (rouge) tant que la souris est dessus
  const play = () => {
    const anim = animRef.current
    if (!anim) return
    if (anim.currentFrame < PLAY_FROM) anim.goToAndStop(PLAY_FROM, true)
    anim.setSpeed(SPEED_IN)
    anim.setDirection(1)
    anim.play()
  }

  // Fin du survol : retour en arrière jusqu'à l'image de repos
  const rewind = () => {
    const anim = animRef.current
    if (!anim || anim.currentFrame <= 0) return
    anim.setSpeed(SPEED_OUT)
    anim.setDirection(-1)
    anim.play()
  }

  const handleClick = async (e: MouseEvent) => {
    // Le bouton est souvent dans une carte cliquable : le clic ne doit pas l'ouvrir
    e.stopPropagation()
    e.preventDefault()
    play()
    const ok = confirm === false || (await askConfirm({ title: `${label} ?`, destructive: true, ...confirm }))
    if (ok) await onDelete()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerEnter={play}
      onPointerLeave={rewind}
      onFocus={play}
      onBlur={rewind}
      // Le glisser-déposer des listes ne doit pas démarrer depuis ce bouton
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={label}
      title={label}
      className={cn(
        "lottie-delete inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        size === "sm" ? "size-7" : "size-9",
        className
      )}
    >
      <span ref={containerRef} aria-hidden className={size === "sm" ? "size-6" : "size-7"} />
    </button>
  )
}
