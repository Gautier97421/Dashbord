// Limitation des tentatives (connexion, inscription) contre les essais de mots de passe en masse.
// En mémoire : suffisant pour une seule instance de l'app (VPS) ; les compteurs repartent à zéro
// au redémarrage.

const attempts = new Map<string, number[]>()
const MAX_KEYS = 10_000

function recent(key: string, windowMs: number): number[] {
  const now = Date.now()
  const list = (attempts.get(key) || []).filter((t) => now - t < windowMs)
  if (list.length) attempts.set(key, list)
  else attempts.delete(key)
  return list
}

/** Vrai si la clé a déjà atteint `max` tentatives dans la fenêtre. */
export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  return recent(key, windowMs).length >= max
}

/** Enregistre une tentative (échec de connexion, inscription…). */
export function recordAttempt(key: string, windowMs: number) {
  if (attempts.size >= MAX_KEYS) {
    // Protection mémoire : on retire les clés dont la fenêtre est passée, puis les plus anciennes
    for (const k of attempts.keys()) recent(k, windowMs)
    while (attempts.size >= MAX_KEYS) attempts.delete(attempts.keys().next().value as string)
  }
  attempts.set(key, [...recent(key, windowMs), Date.now()])
}

const AI_WINDOW_MS = 60 * 60 * 1000
const MAX_AI_CALLS_PER_HOUR = 60

/**
 * Quota d'appels à l'IA par utilisateur (scan de plats, agent, analyse des mails…) : en ligne, chaque
 * appel est facturé par l'API Claude. Vrai si l'appel est permis (et il est compté), faux si dépassé.
 */
export function takeAiQuota(userId: string): boolean {
  const key = `ai:${userId}`
  if (isRateLimited(key, MAX_AI_CALLS_PER_HOUR, AI_WINDOW_MS)) return false
  recordAttempt(key, AI_WINDOW_MS)
  return true
}

export const AI_QUOTA_MESSAGE = "Trop d'appels à l'IA cette heure-ci. Réessaie un peu plus tard."

export function clearAttempts(key: string) {
  attempts.delete(key)
}

/** Adresse IP du client derrière le reverse proxy (Caddy fixe X-Forwarded-For). */
export function clientIp(headers: Headers | Record<string, string | string[] | undefined> | undefined): string {
  const get = (name: string) =>
    headers instanceof Headers ? headers.get(name) : (headers?.[name] as string | string[] | undefined)
  const forwarded = get('x-forwarded-for')
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return value?.split(',')[0]?.trim() || (get('x-real-ip') as string | null) || 'unknown'
}
