// Accès aux fonctionnalités côté serveur (routes API, cron)
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FEATURES, FEATURE_KEYS, type FeatureKey } from "@/lib/feature-defs"

// Seul administrateur de l'app. Comparaison exacte : un compte créé avec une
// variante de casse de cet email n'obtient pas les droits.
export const ADMIN_EMAIL = "gautier.hoarau97421@gmail.com"

export function isAdminEmail(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL
}

export async function getFeatureFlags(): Promise<Record<FeatureKey, boolean>> {
  const rows = await prisma.featureFlag.findMany({ where: { key: { in: FEATURE_KEYS } } })
  const flags = {} as Record<FeatureKey, boolean>
  for (const key of FEATURE_KEYS) {
    flags[key] = rows.find((r) => r.key === key)?.enabled ?? FEATURES[key].defaultEnabled
  }
  return flags
}

export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({ where: { key } })
  return row?.enabled ?? FEATURES[key].defaultEnabled
}

// L'admin a toujours accès ; les autres seulement si la fonctionnalité est activée
export async function userHasFeature(userId: string, key: FeatureKey): Promise<boolean> {
  if (await isFeatureEnabled(key)) return true
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  return isAdminEmail(user?.email)
}

// Filtre Prisma sur la relation `user` : tout le monde si activée, sinon l'admin seulement
export async function featureUserFilter(key: FeatureKey) {
  return (await isFeatureEnabled(key)) ? {} : { user: { email: ADMIN_EMAIL } }
}

// En tête des routes API : renvoie la réponse d'erreur si l'accès est refusé, sinon null
export async function requireFeature(key: FeatureKey): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (isAdminEmail(session.user.email) || (await isFeatureEnabled(key))) return null
  return NextResponse.json({ error: "Fonctionnalité désactivée par l'administrateur" }, { status: 403 })
}
