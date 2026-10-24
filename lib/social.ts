// Amis : demandes, liste et contrôle avant un partage (côté serveur).

import { prisma } from "@/lib/prisma"

export interface PublicUser {
  id: string
  name: string
  email: string
  username: string | null
}

// Pseudo : 3 à 20 caractères, lettres minuscules, chiffres, point et tiret bas (pas au début ni à la fin)
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,18})[a-z0-9]$/

/** Pseudo saisi (« @Gautier », « gautier ») → forme enregistrée, ou null s'il est invalide. */
export function normalizeUsername(input: unknown): string | null {
  if (typeof input !== "string") return null
  const value = input.trim().replace(/^@/, "").toLowerCase()
  return USERNAME_RE.test(value) && !value.includes("..") ? value : null
}

/** Nom affiché : le nom du compte, sinon le début de l'adresse e-mail. */
export const displayName = (user: { name: string | null; email: string }) => user.name?.trim() || user.email.split("@")[0]

export const publicUser = (user: { id: string; name: string | null; email: string; username: string | null }): PublicUser => ({
  id: user.id,
  name: displayName(user),
  email: user.email,
  username: user.username,
})

export const userSelect = { id: true, name: true, email: true, username: true } as const

/** Amis acceptés d'un utilisateur. */
export async function listFriends(userId: string): Promise<(PublicUser & { friendshipId: string })[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: { requester: { select: userSelect }, addressee: { select: userSelect } },
    orderBy: { respondedAt: "desc" },
  })
  return rows
    .map((f) => ({ ...publicUser(f.requesterId === userId ? f.addressee : f.requester), friendshipId: f.id }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
}

/** Sous-ensemble de `ids` qui sont des amis acceptés de l'utilisateur. */
export async function filterFriends(userId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  const rows = await prisma.friendship.findMany({
    where: {
      status: "accepted",
      OR: [
        { requesterId: userId, addresseeId: { in: ids } },
        { addresseeId: userId, requesterId: { in: ids } },
      ],
    },
    select: { requesterId: true, addresseeId: true },
  })
  const ok = new Set(rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId)))
  return ids.filter((id) => ok.has(id))
}
