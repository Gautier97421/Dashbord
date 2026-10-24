"use client"

import { useEffect, useRef } from "react"

// Synchronisation "temps réel" entre appareils : on recharge les données quand l'app redevient
// visible (onglet, app installée rouverte sur mobile), quand le réseau revient, et régulièrement
// tant que l'app est affichée. Rien ne tourne en arrière-plan quand l'app est cachée (batterie).
export const LIVE_REFRESH_INTERVAL_MS = 30_000
const MIN_GAP_MS = 5_000

export function useLiveRefresh(refresh: () => void, intervalMs = LIVE_REFRESH_INTERVAL_MS) {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    let last = Date.now()
    const trigger = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return
      if (Date.now() - last < MIN_GAP_MS) return
      last = Date.now()
      refreshRef.current()
    }
    const onVisibility = () => document.visibilityState === "visible" && trigger()

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", trigger)
    window.addEventListener("online", trigger)
    const timer = setInterval(trigger, intervalMs)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", trigger)
      window.removeEventListener("online", trigger)
      clearInterval(timer)
    }
  }, [intervalMs])
}
