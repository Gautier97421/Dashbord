/**
 * Product watcher — monitors a URL for restock or price drops and notifies.
 *
 * Read-only and legitimate: we fetch the public page, detect availability/price
 * with heuristics, and notify the user (with a direct link to buy). No login,
 * no automation against the site, no credential storage.
 */

import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { postToDiscordWebhook } from './discord';
import { fetchPage } from '@/lib/wishlist/fetch-product';

const OUT_OF_STOCK = [
  'rupture de stock', 'indisponible', 'momentanément indisponible', 'out of stock',
  'sold out', 'currently unavailable', 'non disponible', 'épuisé', 'plus disponible',
];
const IN_STOCK = [
  'en stock', 'add to cart', 'ajouter au panier', 'in stock', 'disponible',
  'buy now', 'acheter maintenant', 'commander', 'add to basket',
];

export interface CheckResult {
  available: boolean;
  price: number | null;
  ok: boolean; // fetch succeeded
}

export async function checkUrl(url: string): Promise<CheckResult> {
  try {
    // Lecture sûre : adresses publiques uniquement (pas d'accès au réseau interne du serveur)
    const res = await fetchPage(url);
    if (res.status < 200 || res.status >= 300) return { available: false, price: null, ok: false };
    const html = res.html.toLowerCase();

    const hasOut = OUT_OF_STOCK.some((k) => html.includes(k));
    const hasIn = IN_STOCK.some((k) => html.includes(k));
    const available = hasIn && !hasOut;

    const price = extractPrice(html);
    return { available, price, ok: true };
  } catch {
    return { available: false, price: null, ok: false };
  }
}

function extractPrice(html: string): number | null {
  // Look for "€" amounts; take the first plausible one
  const m = html.match(/(\d{1,5})[.,](\d{2})\s?(?:€|eur)/) || html.match(/(?:€|eur)\s?(\d{1,5})[.,](\d{2})/);
  if (!m) return null;
  const num = Number(`${m[1]}.${m[2]}`);
  return Number.isFinite(num) ? num : null;
}

/**
 * Check all of a user's active watches and notify on transitions.
 */
export async function runWatchesForUser(userId: string): Promise<number> {
  const watches = await prisma.watch.findMany({ where: { userId, status: 'watching' } });
  if (watches.length === 0) return 0;

  const config = await prisma.agentConfig.findUnique({ where: { userId } });

  let triggered = 0;
  for (const w of watches) {
    const result = await checkUrl(w.url);
    const lastChecked = new Date();

    if (!result.ok) {
      await prisma.watch.update({ where: { id: w.id }, data: { lastChecked, lastStatus: 'inaccessible' } });
      continue;
    }

    let hit = false;
    let message = '';
    if (w.type === 'restock' && result.available) {
      hit = true;
      message = `🟢 De nouveau en stock : ${w.label}`;
    } else if (w.type === 'price' && result.price != null && w.targetPrice != null && result.price <= w.targetPrice) {
      hit = true;
      message = `💸 Prix atteint : ${w.label} est à ${result.price} € (cible ${w.targetPrice} €)`;
    }

    await prisma.watch.update({
      where: { id: w.id },
      data: {
        lastChecked,
        lastStatus: result.available ? 'disponible' : result.price != null ? `${result.price} €` : 'indisponible',
        ...(hit ? { status: 'triggered' as const } : {}),
      },
    });

    if (hit) {
      await createNotification({
        userId, type: 'important',
        title: message,
        body: w.url,
        link: 'ai-agent',
        dedupeKey: `watch:${w.id}:${w.status}`,
        meta: { url: w.url },
      });
      if (config?.forwardToDiscord && config.discordWebhookUrl) {
        await postToDiscordWebhook(config.discordWebhookUrl, `${message}\n${w.url}`);
      }
      triggered++;
    }
  }
  return triggered;
}
