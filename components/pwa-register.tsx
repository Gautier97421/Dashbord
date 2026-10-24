"use client"

import { useEffect } from "react"
import { listenForInstallPrompt } from "@/lib/pwa-install"

// Enregistre le service worker (production uniquement, pour ne pas gêner le hot reload en dev)
// et capte l'invitation d'installation pour le bouton des paramètres
export function PwaRegister() {
  useEffect(() => listenForInstallPrompt(), [])

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return

    // Une app installée peut rester ouverte des jours : on cherche une nouvelle version à chaque
    // retour dessus, et on recharge une fois quand elle prend le relais (sinon l'ancienne page
    // réclamerait des fichiers qui n'existent plus après une mise à jour)
    const hadController = !!navigator.serviceWorker.controller
    let reloading = false
    const onControllerChange = () => {
      if (!hadController || reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

    let registration: ServiceWorkerRegistration | undefined
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => { registration = reg })
      .catch((err) => console.error("Service worker registration failed:", err))

    const checkForUpdate = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => {})
    }
    document.addEventListener("visibilitychange", checkForUpdate)

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
      document.removeEventListener("visibilitychange", checkForUpdate)
    }
  }, [])

  return null
}
