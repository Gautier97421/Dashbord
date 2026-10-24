"use client"

import { useSyncExternalStore } from "react"

// Événement non standard exposé par Chrome / Edge / Samsung Internet
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

interface InstallState {
  canPrompt: boolean
  installed: boolean
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let state: InstallState = { canPrompt: false, installed: false }
const listeners = new Set<() => void>()
const SERVER_STATE: InstallState = { canPrompt: false, installed: false }

function setState(next: Partial<InstallState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

// À appeler une seule fois au démarrage de l'app (l'événement arrive tôt, souvent avant l'ouverture des paramètres)
export function listenForInstallPrompt() {
  const onPrompt = (e: Event) => {
    deferredPrompt = e as BeforeInstallPromptEvent
    setState({ canPrompt: true })
  }
  const onInstalled = () => {
    deferredPrompt = null
    setState({ canPrompt: false, installed: true })
  }
  window.addEventListener("beforeinstallprompt", onPrompt)
  window.addEventListener("appinstalled", onInstalled)
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt)
    window.removeEventListener("appinstalled", onInstalled)
  }
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  const promptEvent = deferredPrompt
  deferredPrompt = null
  setState({ canPrompt: false })
  await promptEvent.prompt()
  const { outcome } = await promptEvent.userChoice
  return outcome === "accepted"
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos() {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export function useInstallState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => SERVER_STATE
  )
}
