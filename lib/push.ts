// Notifications push (Web Push) vers les appareils abonnés : PWA installée sur mobile, navigateur sur ordinateur.
// Clés VAPID : `npx web-push generate-vapid-keys`, puis VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY dans l'environnement.

import webpush from "web-push"
import { prisma } from "@/lib/prisma"

let configured: boolean | null = null

export function isPushConfigured(): boolean {
  if (configured !== null) return configured
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return (configured = false)
  try {
    // Le "subject" identifie l'expéditeur auprès des services push (Google, Mozilla, Apple)
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${process.env.ACME_EMAIL || "admin@localhost"}`, publicKey, privateKey)
    configured = true
  } catch (error) {
    console.error("Invalid VAPID keys:", error)
    configured = false
  }
  return configured
}

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || null

export interface PushPayload {
  title: string
  body?: string
  // Adresse ouverte au clic, dans l'app (ex. "/?page=projects&task=…")
  url?: string
  // Remplace une notification précédente de même tag au lieu d'en empiler une nouvelle
  tag?: string
}

/** Envoie à tous les appareils de l'utilisateur ; renvoie le nombre d'envois réussis. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!isPushConfigured()) return 0
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  let sent = 0
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12, urgency: "normal" }
        )
        sent++
      } catch (error: any) {
        // Abonnement expiré ou révoqué (app désinstallée, permission retirée)
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          console.error("Push send failed:", error?.statusCode || error)
        }
      }
    })
  )
  return sent
}
