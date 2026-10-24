"use client"

import { useCallback, useEffect, useState } from "react"
import { BellRing, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { ALERT_KINDS, type AlertKind } from "@/lib/projects/core"
import { isIos, isStandalone } from "@/lib/pwa-install"

interface AlertPrefs {
  enabled: boolean
  push: boolean
  kinds: Record<AlertKind, boolean>
  timeZone: string
  quietStart: number
  quietEnd: number
}

interface PushInfo {
  configured: boolean
  publicKey: string | null
  devices: number
}

type DeviceState = "unsupported" | "ios-install" | "no-worker" | "denied" | "off" | "on"

// La clé VAPID est en base64 "URL" ; PushManager attend des octets
function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)

/** Réglages des notifications des projets : push sur cet appareil et types d'alertes. */
export function NotificationSettings() {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<AlertPrefs | null>(null)
  const [push, setPush] = useState<PushInfo | null>(null)
  const [device, setDevice] = useState<DeviceState | null>(null)
  const [busy, setBusy] = useState(false)

  const detectDevice = useCallback(async (): Promise<DeviceState> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      // Sur iPhone, le push n'existe que dans l'app installée sur l'écran d'accueil
      return isIos() && !isStandalone() ? "ios-install" : "unsupported"
    }
    if (!(await navigator.serviceWorker.getRegistration())) return "no-worker"
    if (Notification.permission === "denied") return "denied"
    return (await currentSubscription()) ? "on" : "off"
  }, [])

  useEffect(() => {
    fetch("/api/alert-prefs").then((r) => (r.ok ? r.json() : null)).then(setPrefs).catch(() => {})
    fetch("/api/push").then((r) => (r.ok ? r.json() : null)).then(setPush).catch(() => {})
    detectDevice().then(setDevice)
  }, [detectDevice])

  const savePrefs = async (changes: Partial<AlertPrefs>) => {
    if (!prefs) return
    const next = { ...prefs, ...changes, kinds: { ...prefs.kinds, ...(changes.kinds || {}) } }
    setPrefs(next)
    try {
      const res = await fetch("/api/alert-prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) })
      if (!res.ok) throw new Error()
    } catch {
      setPrefs(prefs)
      toast({ title: "Réglage non enregistré", variant: "destructive" })
    }
  }

  const enableDevice = async () => {
    if (!push?.publicKey) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setDevice(permission === "denied" ? "denied" : "off")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(push.publicKey) }))
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      if (!res.ok) throw new Error()
      setDevice("on")
      setPush((p) => (p ? { ...p, devices: p.devices + 1 } : p))
      toast({ title: "Notifications activées sur cet appareil" })
    } catch {
      toast({ title: "Activation impossible", description: "Réessaie, ou vérifie les autorisations du navigateur.", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const disableDevice = async () => {
    setBusy(true)
    try {
      const subscription = await currentSubscription()
      if (subscription) {
        await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) })
        await subscription.unsubscribe()
      }
      setDevice("off")
      setPush((p) => (p ? { ...p, devices: Math.max(0, p.devices - 1) } : p))
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null)
    const data = res?.ok ? await res.json() : null
    toast(
      data?.sent
        ? { title: "Notification envoyée", description: `Sur ${data.sent} appareil${data.sent > 1 ? "s" : ""}` }
        : { title: "Aucun appareil n'a reçu la notification", variant: "destructive" }
    )
  }

  const deviceMessage: Record<Exclude<DeviceState, "on" | "off">, string> = {
    unsupported: "Ce navigateur ne gère pas les notifications push.",
    "ios-install": "Sur iPhone et iPad, installe d'abord l'app : Partager → « Sur l'écran d'accueil », puis ouvre-la depuis l'icône.",
    "no-worker": "Les notifications push nécessitent la version installée de l'app (service worker actif, en production).",
    denied: "Les notifications sont bloquées pour ce site : autorise-les dans les réglages du navigateur.",
  }

  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-2">
        <h3 className="font-medium">Sur cet appareil</h3>
        {push && !push.configured ? (
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            Le serveur n&apos;a pas de clés VAPID : génère-les avec <code>npx web-push generate-vapid-keys</code> puis ajoute VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY à l&apos;environnement.
          </p>
        ) : device === null || push === null ? (
          <p className="text-muted-foreground">Vérification…</p>
        ) : device === "on" || device === "off" ? (
          <div className="flex flex-wrap items-center gap-3">
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={device === "on"} disabled={busy} onCheckedChange={(on) => (on ? enableDevice() : disableDevice())} />
              Recevoir les notifications ici
              {busy && <Loader2 className="size-4 animate-spin" />}
            </Label>
            {device === "on" && (
              <Button variant="outline" size="sm" onClick={sendTest}>
                <Send className="size-4" />
                Tester
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {push.devices} appareil{push.devices > 1 ? "s" : ""} abonné{push.devices > 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{deviceMessage[device]}</p>
        )}
      </section>

      {prefs && (
        <>
          <section className="space-y-2">
            <h3 className="font-medium">Alertes des projets</h3>
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={prefs.enabled} onCheckedChange={(enabled) => savePrefs({ enabled })} />
              Notifier les alertes (cloche de l&apos;app)
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={prefs.push} disabled={!prefs.enabled} onCheckedChange={(on) => savePrefs({ push: on })} />
              Les envoyer aussi en push
            </Label>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-medium">Quelles alertes ?</h3>
            {ALERT_KINDS.map(({ kind, label, description }) => (
              <Label key={kind} className="flex items-start gap-2 font-normal">
                <Checkbox className="mt-0.5" checked={prefs.kinds[kind]} disabled={!prefs.enabled} onCheckedChange={(c) => savePrefs({ kinds: { [kind]: !!c } as Record<AlertKind, boolean> })} />
                <span>
                  {label}
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
              </Label>
            ))}
          </section>

          <section className="space-y-1.5">
            <h3 className="font-medium">Heures calmes</h3>
            <p className="text-xs text-muted-foreground">Aucune notification pendant cette plage ({prefs.timeZone}).</p>
            <div className="flex items-center gap-2">
              <span>De</span>
              <Select value={String(prefs.quietStart)} onValueChange={(v) => savePrefs({ quietStart: Number(v) })}>
                <SelectTrigger size="sm" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>{`${h} h`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>à</span>
              <Select value={String(prefs.quietEnd)} onValueChange={(v) => savePrefs({ quietEnd: Number(v) })}>
                <SelectTrigger size="sm" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>{`${h} h`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export function NotificationsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-5" /> Notifications
        </CardTitle>
        <CardDescription>Retards, échéances proches, tâches bloquées, projets à l&apos;arrêt : sur ton téléphone même quand l&apos;app est fermée.</CardDescription>
      </CardHeader>
      <CardContent>
        <NotificationSettings />
      </CardContent>
    </Card>
  )
}
