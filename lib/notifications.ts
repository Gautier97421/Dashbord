/**
 * Notification helper — create user notifications with de-duplication.
 */

import { prisma } from '@/lib/prisma';

type NotificationType =
  | 'info' | 'subscription' | 'cancellation' | 'price_increase'
  | 'trial_ending' | 'application' | 'important' | 'agent' | 'project' | 'task' | 'wishlist' | 'trip' | 'social';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  dedupeKey?: string;
  meta?: Record<string, unknown>;
}

/**
 * Create a notification, skipping if one with the same dedupeKey already exists.
 * Returns true if a new notification was created.
 */
export async function createNotification(input: NotifyInput): Promise<boolean> {
  if (input.dedupeKey) {
    const existing = await prisma.notification.findFirst({
      where: { userId: input.userId, dedupeKey: input.dedupeKey },
      select: { id: true },
    });
    if (existing) return false;
  }

  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type as any,
        title: input.title,
        body: input.body || null,
        link: input.link || null,
        dedupeKey: input.dedupeKey || null,
        meta: (input.meta || undefined) as any,
      },
    });
    return true;
  } catch {
    // Unique constraint race — treat as already exists
    return false;
  }
}
