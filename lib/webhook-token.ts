import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Deterministic per-workflow webhook token (no DB column needed).
 * Computed from the workflow id + server secret, so it can be verified without storage.
 */
export function workflowWebhookToken(workflowId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('NEXTAUTH_SECRET manquant');
  return createHmac('sha256', secret || 'dev-secret').update(`wf:${workflowId}`).digest('hex').slice(0, 32);
}

/**
 * Compare un secret reçu (jeton, en-tête Authorization) à la valeur attendue en temps constant :
 * la durée de la comparaison ne révèle pas combien de caractères sont justes.
 */
export function sameSecret(received: string | null | undefined, expected: string): boolean {
  if (!received) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}
