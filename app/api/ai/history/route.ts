/**
 * GET /api/ai/history
 * 
 * Get user's action history
 * 
 * Query params:
 * - limit: number of items to return (default 50, max 100)
 * 
 * Response:
 * {
 *   "actions": [
 *     {
 *       "id": "log_123",
 *       "actionType": "gmail.labelEmails",
 *       "status": "success",
 *       "input": { ... },
 *       "output": { ... },
 *       "createdAt": "2024-01-01T00:00:00Z"
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireFeature } from '@/lib/features';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const denied = await requireFeature('ai-agent');
    if (denied) return denied;

    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Parse query params
    const url = new URL(req.url);
    let limit = parseInt(url.searchParams.get('limit') || '50', 10);
    
    if (limit < 1 || limit > 100) {
      limit = 50;
    }

    // 4. Fetch action history
    const actions = await prisma.actionLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        actionType: true,
        status: true,
        input: true,
        output: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    // 5. Return history
    return NextResponse.json({
      success: true,
      count: actions.length,
      actions,
    });
  } catch (error: any) {
    console.error('Error in /api/ai/history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
