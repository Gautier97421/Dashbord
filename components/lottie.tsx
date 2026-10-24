"use client"

import { useEffect, useRef } from "react"
import type { AnimationItem } from "lottie-web"
import { cn } from "@/lib/utils"

// Animations Lottie de public/ (chargées à la demande, pas dans le JavaScript de l'app), jouées avec le
// lecteur "léger" (rendu SVG, sans expressions donc sans eval)

let lottiePromise: Promise<typeof import("lottie-web/build/player/lottie_light").default> | null = null
export const loadLottie = () => (lottiePromise ??= import("lottie-web/build/player/lottie_light").then((m) => m.default))

const dataCache = new Map<string, Promise<unknown>>()
export function loadAnimationData(src: string): Promise<unknown> {
  let promise = dataCache.get(src)
  if (!promise) {
    promise = fetch(encodeURI(src)).then((r) => {
      if (!r.ok) throw new Error(`Animation introuvable : ${src}`)
      return r.json()
    })
    promise.catch(() => dataCache.delete(src))
    dataCache.set(src, promise)
  }
  return promise
}

type Rgba = number[]
const isColor = (v: unknown): v is Rgba => Array.isArray(v) && v.length >= 3 && v.every((n) => typeof n === "number")

/**
 * Recolore les remplissages et contours : `ink` = les couleurs (quasi) noires, `all` = toutes. Elles
 * deviennent du noir pur, que le CSS (.lottie-ink dans globals.css) remplace par la couleur du texte :
 * l'animation suit ainsi le thème clair / sombre.
 */
function recolor(node: unknown, mode: "ink" | "all"): unknown {
  if (Array.isArray(node)) return node.map((n) => recolor(n, mode))
  if (!node || typeof node !== "object") return node
  const obj = node as Record<string, unknown>
  const out: Record<string, unknown> = {}
  const shouldRecolor = (c: Rgba) => mode === "all" || c[0] + c[1] + c[2] < 0.45
  for (const [key, value] of Object.entries(obj)) {
    if (key === "c" && (obj.ty === "fl" || obj.ty === "st") && value && typeof value === "object") {
      const color = value as { a?: number; k?: unknown }
      if (color.a === 0 && isColor(color.k) && shouldRecolor(color.k)) {
        out[key] = { ...color, k: [0, 0, 0, 1] }
        continue
      }
      if (color.a === 1 && Array.isArray(color.k)) {
        out[key] = {
          ...color,
          k: color.k.map((kf: Record<string, unknown>) => ({
            ...kf,
            ...(isColor(kf.s) && shouldRecolor(kf.s) ? { s: [0, 0, 0, 1] } : {}),
            ...(isColor(kf.e) && shouldRecolor(kf.e) ? { e: [0, 0, 0, 1] } : {}),
          })),
        }
        continue
      }
    }
    out[key] = recolor(value, mode)
  }
  return out
}

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

export interface LottieProps {
  // Chemin dans public/, ex. "/animations/utilisees/Walking Avocado.json"
  src: string
  className?: string
  // "loop" : joue en boucle ; "hover" : joue (en boucle) tant que l'élément parent est survolé ;
  // "manual" : contrôlé par `playing` ; "static" : première image
  mode?: "loop" | "hover" | "manual" | "static"
  playing?: boolean
  // Partie de l'animation à jouer (images de début et de fin)
  segment?: [number, number]
  speed?: number
  // Couleurs suivant le thème : "ink" = traits noirs seulement, "all" = animation monochrome
  adaptive?: "ink" | "all"
  // Agrandissement du dessin dans son cadre (animations avec beaucoup de marge autour)
  zoom?: number
  // Transformation des données avant lecture (retirer un calque, changer une image…)
  transform?: (data: any) => any | Promise<any>
  // Clé de la transformation : la changer recharge l'animation
  transformKey?: string
  // Changer cette valeur joue l'animation une fois
  pulseKey?: number
}

/** Animation Lottie décorative (masquée aux lecteurs d'écran). */
export function Lottie({ src, className, mode = "loop", playing, segment, speed = 1, adaptive, zoom, transform, transformKey, pulseKey }: LottieProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const playingRef = useRef(playing)
  playingRef.current = playing

  const start = () => {
    const anim = animRef.current
    if (!anim || prefersReducedMotion()) return
    if (segment) anim.playSegments(segment, true)
    else anim.play()
  }
  const stop = () => animRef.current?.goToAndStop(segment?.[0] ?? 0, true)

  useEffect(() => {
    let disposed = false
    const container = containerRef.current
    if (!container) return
    Promise.all([loadLottie(), loadAnimationData(src)])
      .then(async ([lottie, raw]) => {
        if (disposed) return
        let data: any = structuredClone(raw)
        if (transform) data = await transform(data)
        if (adaptive) data = recolor(data, adaptive)
        if (disposed) return
        const anim = lottie.loadAnimation({
          container,
          renderer: "svg",
          loop: mode !== "manual" || !!segment,
          autoplay: false,
          animationData: data,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        })
        anim.setSpeed(speed)
        animRef.current = anim
        const svg = container.querySelector("svg")
        // Propriété `scale` (et non `transform`, que Lottie écrit lui-même sur le SVG)
        if (svg && zoom) svg.style.scale = String(zoom)
        stop()
        if (mode === "loop" || (mode === "manual" && playingRef.current)) start()
      })
      .catch(() => {
        /* animation indisponible : rien n'est affiché */
      })
    return () => {
      disposed = true
      animRef.current?.destroy()
      animRef.current = null
    }
    // Rechargement seulement si l'animation elle-même change (pas à chaque rendu du parent)
  }, [src, adaptive, transformKey])

  // Mode "manual" : suit `playing`
  useEffect(() => {
    if (mode !== "manual" || !animRef.current) return
    if (playing) start()
    else if (!segment) animRef.current.pause()
    else stop()
  }, [playing, mode])

  // Mode "hover" : joue tant que l'élément parent (bouton…) est survolé ou a le focus
  useEffect(() => {
    if (mode !== "hover") return
    const target = containerRef.current?.parentElement
    if (!target) return
    target.addEventListener("pointerenter", start)
    target.addEventListener("pointerleave", stop)
    target.addEventListener("focus", start)
    target.addEventListener("blur", stop)
    return () => {
      target.removeEventListener("pointerenter", start)
      target.removeEventListener("pointerleave", stop)
      target.removeEventListener("focus", start)
      target.removeEventListener("blur", stop)
    }
  }, [mode, segment?.[0], segment?.[1]])

  // Joue l'animation une fois chaque fois que `pulseKey` change (ex. nouvelle notification)
  useEffect(() => {
    const anim = animRef.current
    if (!pulseKey || !anim) return
    const once = () => {
      anim.removeEventListener("loopComplete", once)
      stop()
    }
    anim.addEventListener("loopComplete", once)
    start()
  }, [pulseKey])

  return <span ref={containerRef} aria-hidden className={cn("pointer-events-none inline-block shrink-0", adaptive && "lottie-ink", className)} />
}

/** Icône "…" des menus : les points rebondissent au survol, dans la couleur du texte. */
export function MoreDots({ className }: { className?: string }) {
  return <Lottie src="/animations/utilisees/Dots preloader.json" mode="hover" adaptive="all" zoom={1.9} speed={1.2} className={cn("size-5", className)} />
}

/** Flamme animée des séries (streaks) : orange par défaut, bleue pour la routine du soir. */
export function StreakFlame({ variant = "orange", className }: { variant?: "orange" | "blue"; className?: string }) {
  // Partie "Loop" de l'animation (marqueurs Idle / On Click / Loop du fichier)
  return <Lottie src={variant === "blue" ? "/animations/utilisees/flamebleu.json" : "/animations/utilisees/flame2.0.json"} segment={[179, 299]} className={cn("size-4", className)} />
}

// ─── Corrections d'animations ────────────────────────────────────────────────

/**
 * "Hands typing on keyboard" enchaîne 7 copies de la même séquence de 21 images. Chaque copie, masquée
 * jusqu'à son tour, s'affiche quelques images sans ses couleurs (mains noires) : on garde la première
 * séquence et on la fait boucler, ce qui donne exactement le même mouvement.
 */
export function keepFirstCycle(data: any) {
  const first = data.layers.reduce((a: any, b: any) => (b.ip < a.ip ? b : a))
  data.layers = [first]
  data.ip = first.ip
  data.op = first.op
  return data
}

/** "Data Dashboard" sans son fond bleuté (cadres et reflets derrière les panneaux blancs). */
export function withoutDashboardBackground(data: any) {
  for (const asset of data.assets || []) {
    if (!asset.layers?.some((l: any) => String(l.nm).startsWith("bg-white-frames"))) continue
    asset.layers = asset.layers.filter((l: any) => String(l.nm).startsWith("bg-white-frames"))
  }
  return data
}
