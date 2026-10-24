/**
 * POST /api/ai/confirm
 * 
 * User confirms an AI suggestion
 * Backend validates and executes the tool
 * 
 * Request body:
 * {
 *   "suggestionId": "sug_123",
 *   "approved": true
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "result": {
 *     "emailsModified": 5,
 *     "details": "..."
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireFeature } from '@/lib/features';
import { aiOrchestrator } from '@/lib/ai-agent/orchestrator';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
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

    // 3. Parse request
    const body = await req.json();
    const { suggestionId, approved } = body;

    if (!suggestionId || typeof suggestionId !== 'string') {
      return NextResponse.json(
        { error: 'suggestionId is required' },
        { status: 400 }
      );
    }

    if (typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'approved must be a boolean' },
        { status: 400 }
      );
    }

    // 4. Fetch suggestion
    const suggestion = await prisma.aISuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (suggestion.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 5. Update suggestion status
    if (approved) {
      // Mark as approved
      await prisma.aISuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'approved',
          confirmedAt: new Date(),
        },
      });

      // Execute the tool
      const result = await aiOrchestrator.execute(user.id, suggestionId);

      return NextResponse.json({
        success: result.success,
        result: result.result,
        error: result.error,
      });
    } else {
      // Reject suggestion
      await prisma.aISuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'rejected',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Suggestion rejected',
      });
    }
  } catch (error: any) {
    console.error('Error in /api/ai/confirm:', error);
    return NextResponse.json(
      { error: 'Failed to confirm suggestion' },
      { status: 500 }
    );
  }
}
