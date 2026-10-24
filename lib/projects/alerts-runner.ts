// Transforme les alertes projets (lib/projects/core) en notifications : cloche de l'app et push.
// Appelé par le cron (/api/cron/run, toutes les 5 min en production) et, à défaut de cron, à
// l'ouverture des notifications (au plus une fois toutes les 10 min par utilisateur).

import { prisma } from "@/lib/prisma"
import { computeAlerts, dayKey, hourIn, type ProjectAlert } from "@/lib/projects/core"
import { getAlertPrefs } from "@/lib/projects/alert-prefs"
import { sendPushToUser } from "@/lib/push"

const LAZY_MIN_GAP_MS = 10 * 60_000
const MAX_INDIVIDUAL_PUSH = 3
const SENT_ALERT_RETENTION_DAYS = 120
const lastRun = new Map<string, number>()

const isQuiet = (h: number, start: number, end: number) => (start > end ? h >= start || h < end : h >= start && h < end)

export const alertUrl = (a: Pick<ProjectAlert, "taskId" | "projectId">) =>
  a.taskId ? `/?page=projects&task=${a.taskId}` : a.projectId ? `/?page=projects&project=${a.projectId}` : "/?page=projects"

export async function runProjectAlerts(userId: string): Promise<{ created: number; pushed: number }> {
  lastRun.set(userId, Date.now())
  const prefs = await getAlertPrefs(userId)
  if (!prefs.enabled) return { created: 0, pushed: 0 }
  // Rien la nuit : les alertes du jour partiront au début de la plage d'envoi
  if (isQuiet(hourIn(prefs.timeZone), prefs.quietStart, prefs.quietEnd)) return { created: 0, pushed: 0 }

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, title: true, status: true, deadline: true, startDate: true, completedAt: true, parentId: true, updatedAt: true, createdAt: true },
    }),
    prisma.task.findMany({
      where: { userId, deletedAt: null, missionId: null },
      select: { id: true, title: true, status: true, dueDate: true, projectId: true, missionId: true, dependsOn: true, updatedAt: true, createdAt: true },
    }),
  ])

  const alerts = computeAlerts({ projects, tasks, today: dayKey(new Date(), prefs.timeZone) }).filter(
    (a) => a.notify && prefs.kinds[a.kind]
  )
  if (!alerts.length) return { created: 0, pushed: 0 }

  const sent = await prisma.sentAlert.findMany({
    where: { userId, dedupeKey: { in: alerts.map((a) => a.dedupeKey) } },
    select: { dedupeKey: true },
  })
  const already = new Set(sent.map((s) => s.dedupeKey))
  const fresh = alerts.filter((a) => !already.has(a.dedupeKey))
  if (!fresh.length) return { created: 0, pushed: 0 }

  await prisma.sentAlert.createMany({ data: fresh.map((a) => ({ userId, dedupeKey: a.dedupeKey })), skipDuplicates: true })
  await prisma.notification.createMany({
    data: fresh.map((a) => ({
      userId,
      type: a.kind.startsWith("task") ? ("task" as const) : ("project" as const),
      title: a.title,
      body: a.body,
      link: "projects",
      dedupeKey: `alert:${a.dedupeKey}`,
      meta: { kind: a.kind, taskId: a.taskId ?? null, projectId: a.projectId ?? null },
    })),
    skipDuplicates: true,
  })

  let pushed = 0
  if (prefs.push) {
    // Au-delà de quelques alertes, un résumé plutôt qu'une rafale de notifications
    const individual = fresh.length <= MAX_INDIVIDUAL_PUSH ? fresh : fresh.slice(0, 1)
    for (const a of individual) {
      pushed += await sendPushToUser(userId, { title: a.title, body: a.body, url: alertUrl(a), tag: a.dedupeKey })
    }
    if (fresh.length > MAX_INDIVIDUAL_PUSH) {
      const rest = fresh.length - 1
      pushed += await sendPushToUser(userId, {
        title: `${rest} autre${rest > 1 ? "s" : ""} alerte${rest > 1 ? "s" : ""} projets`,
        body: fresh.slice(1, 4).map((a) => a.title).join(" · "),
        url: "/?page=projects&view=overview",
        tag: "project-alerts-summary",
      })
    }
  }

  return { created: fresh.length, pushed }
}

/** Version limitée pour les appels à la demande (sans cron) : au plus une fois toutes les 10 minutes. */
export async function maybeRunProjectAlerts(userId: string) {
  if (Date.now() - (lastRun.get(userId) || 0) < LAZY_MIN_GAP_MS) return
  try {
    await runProjectAlerts(userId)
  } catch (error) {
    console.error("Project alerts failed:", error)
  }
}

export async function runProjectAlertsForAllUsers() {
  const users = await prisma.user.findMany({
    where: { OR: [{ projects: { some: { deletedAt: null } } }, { tasks: { some: { deletedAt: null, missionId: null } } }] },
    select: { id: true },
  })
  const results: { userId: string; created: number; pushed: number; error?: string }[] = []
  for (const { id } of users) {
    try {
      results.push({ userId: id, ...(await runProjectAlerts(id)) })
    } catch (error) {
      results.push({ userId: id, created: 0, pushed: 0, error: error instanceof Error ? error.message : "Unknown error" })
    }
  }
  const limit = new Date(Date.now() - SENT_ALERT_RETENTION_DAYS * 86_400_000)
  await prisma.sentAlert.deleteMany({ where: { createdAt: { lt: limit } } })
  return results
}
