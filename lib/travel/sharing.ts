// Partage des voyages : prévient les amis ajoutés (cloche + push).

import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { sendPushToUser } from "@/lib/push"
import { displayName } from "@/lib/social"

export async function notifyTripShared(tripId: string, byUserId: string, userIds: string[]) {
  if (!userIds.length) return
  const [trip, by] = await Promise.all([
    prisma.trip.findUnique({ where: { id: tripId }, select: { title: true, destination: true } }),
    prisma.user.findUnique({ where: { id: byUserId }, select: { name: true, email: true } }),
  ])
  if (!trip || !by) return
  const title = `${displayName(by)} partage un voyage avec toi`
  const body = `${trip.title} · ${trip.destination} : vous pouvez préparer le programme ensemble.`
  for (const userId of userIds) {
    const created = await createNotification({ userId, type: "trip", title, body, link: "travel", dedupeKey: `trip-shared:${tripId}:${userId}` })
    if (created) await sendPushToUser(userId, { title, body, url: "/?page=travel", tag: `trip-shared-${tripId}` }).catch(() => 0)
  }
}
