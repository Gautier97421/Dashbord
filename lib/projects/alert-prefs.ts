// Préférences des alertes projets, stockées dans UserSettings.alertPrefs (JSON).

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ALERT_KINDS, type AlertKind } from "@/lib/projects/core"

export interface AlertPrefs {
  // Notifications in-app (cloche) pour les alertes projets
  enabled: boolean
  // Envoi aussi en push sur les appareils abonnés
  push: boolean
  kinds: Record<AlertKind, boolean>
  // Fuseau de l'utilisateur, pour savoir quel jour on est et ne rien envoyer la nuit
  timeZone: string
  // Plage horaire d'envoi (heures locales)
  quietStart: number
  quietEnd: number
}

export const DEFAULT_TIME_ZONE = process.env.APP_TIMEZONE || "Europe/Paris"

export function defaultAlertPrefs(): AlertPrefs {
  return {
    enabled: true,
    push: true,
    kinds: Object.fromEntries(ALERT_KINDS.map((k) => [k.kind, true])) as Record<AlertKind, boolean>,
    timeZone: DEFAULT_TIME_ZONE,
    quietStart: 21,
    quietEnd: 8,
  }
}

const isTimeZone = (tz: unknown): tz is string => {
  if (typeof tz !== "string" || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const hour = (v: unknown, fallback: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 23 ? (v as number) : fallback)

/** Fusionne une saisie (partielle, non fiable) avec les préférences existantes. */
export function mergeAlertPrefs(current: AlertPrefs, input: any): AlertPrefs {
  const kinds = { ...current.kinds }
  if (input?.kinds && typeof input.kinds === "object") {
    for (const { kind } of ALERT_KINDS) if (typeof input.kinds[kind] === "boolean") kinds[kind] = input.kinds[kind]
  }
  return {
    enabled: typeof input?.enabled === "boolean" ? input.enabled : current.enabled,
    push: typeof input?.push === "boolean" ? input.push : current.push,
    kinds,
    timeZone: isTimeZone(input?.timeZone) ? input.timeZone : current.timeZone,
    quietStart: hour(input?.quietStart, current.quietStart),
    quietEnd: hour(input?.quietEnd, current.quietEnd),
  }
}

export async function getAlertPrefs(userId: string): Promise<AlertPrefs> {
  const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { alertPrefs: true } })
  return mergeAlertPrefs(defaultAlertPrefs(), settings?.alertPrefs ?? {})
}

export async function saveAlertPrefs(userId: string, prefs: AlertPrefs) {
  const alertPrefs = prefs as unknown as Prisma.InputJsonValue
  await prisma.userSettings.upsert({ where: { userId }, update: { alertPrefs }, create: { userId, alertPrefs } })
}
