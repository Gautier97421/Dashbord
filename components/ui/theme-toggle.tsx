"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"
import type { AnimationItem } from "lottie-web"
import { loadAnimationData, loadLottie } from "@/components/lottie"

// Première image : soleil et nuages (thème clair) ; dernière image : lune et étoiles (thème sombre)
const SRC = "/animations/utilisees/animation de mode sombre.json"

// Vitesse de lecture (1 = 1,4 s) : le retour au jour, joué à l'envers, est plus rapide
const SPEED_TO_DARK = 1.4
const SPEED_TO_LIGHT = 1.8

const prefersReducedMotion =() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const isDark = resolvedTheme === "dark"
  const isDarkRef = useRef(isDark)
  isDarkRef.current = isDark

  // Éviter les problèmes d'hydratation : le thème n'est connu que dans le navigateur
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    let disposed = false
    Promise.all([loadLottie(), loadAnimationData(SRC)])
      .then(([lottie, data]) => {
        if (disposed || !containerRef.current) return
        const anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: false,
          autoplay: false,
          animationData: structuredClone(data),
        })
        // Position de départ : celle du thème actuel, sans animation
        anim.addEventListener("DOMLoaded", () => anim.goToAndStop(isDarkRef.current ? anim.totalFrames - 1 : 0, true))
        animRef.current = anim
      })
      .catch(() => undefined)
    return () => {
      disposed = true
      animRef.current?.destroy()
      animRef.current = null
    }
  }, [mounted])

  // Changement de thème (ici ou ailleurs, ex. Paramètres) : jour → nuit en avant, nuit → jour à l'envers
  useEffect(() => {
    const anim = animRef.current
    if (!anim || !anim.isLoaded) return
    if (prefersReducedMotion()) {
      anim.goToAndStop(isDark ? anim.totalFrames - 1 : 0, true)
      return
    }
    anim.setSpeed(isDark ? SPEED_TO_DARK : SPEED_TO_LIGHT)
    anim.setDirection(isDark ? 1 : -1)
    anim.play()
  }, [isDark])

  if (!mounted) {
    // Même place réservée pour éviter un décalage de l'en-tête
    return <span className="inline-block h-7 w-[66px]" aria-hidden />
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Passer au thème clair" : "Passer au thème sombre"}
      title={isDark ? "Thème clair" : "Thème sombre"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-7 w-[66px] shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span ref={containerRef} className="block size-full [&_svg]:block" aria-hidden />
    </button>
  )
}
