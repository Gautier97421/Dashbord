/**
 * POST /api/ai/analyze
 * 
 * User submits email analysis request
 * AI engine analyzes and returns suggestion
 * 
 * Request body:
 * {
 *   "request": "Organize my important emails"
 * }
 * 
 * Response:
 * {
 *   "suggestionId": "sug_123",
 *   "tool": "gmail.labelEmails",
 *   "humanReadable": "Label emails from important senders as 'Important'",
 *   "params": { ... }
 * }
 */

import { AI_QUOTA_MESSAGE, takeAiQuota } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireFeature } from '@/lib/features';
import { aiOrchestrator } from '@/lib/ai-agent/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const denied = await requireFeature('ai-agent');
    if (denied) return denied;

    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get user from database
    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!takeAiQuota(user.id)) return NextResponse.json({ error: AI_QUOTA_MESSAGE }, { status: 429 });

    // 3. Parse request body
    const body = await req.json();
    const { request } = body;

    if (!request || typeof request !== 'string') {
      return NextResponse.json(
        { error: 'request field is required and must be a string' },
        { status: 400 }
      );
    }

    if (request.length < 5 || request.length > 1000) {
      return NextResponse.json(
        { error: 'request must be between 5 and 1000 characters' },
        { status: 400 }
      );
    }

    // 4. Call AI orchestrator
    const suggestion = await aiOrchestrator.analyze(user.id, request);

    // 5. Return suggestion
    return NextResponse.json({
      success: true,
      suggestionId: suggestion.id,
      tool: suggestion.tool,
      params: suggestion.params,
      humanReadable: generateHumanReadable(suggestion.tool, suggestion.params),
    });
  } catch (error: any) {
    console.error('Error in /api/ai/analyze:', error);

    if (error.message?.includes('No Gmail account')) {
      return NextResponse.json(
        { error: 'Gmail account not connected. Please authorize first.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to analyze request' },
      { status: 500 }
    );
  }
}

/**
 * Generate human-readable description of AI suggestion
 */
function generateHumanReadable(tool: string, params: any): string {
  const toolDescriptions: Record<string, () => string> = {
    'gmail.labelEmails': () => {
      const { label, filter } = params;
      return `Label emails (matching "${filter}") with "${label}"`;
    },
    'gmail.moveEmails': () => {
      const { targetLabel, filter } = params;
      return `Move emails (matching "${filter}") to "${targetLabel}"`;
    },
    'gmail.readEmails': () => {
      const { filter, maxResults } = params;
      return `Find up to ${maxResults} emails matching "${filter}"`;
    },
  };

  const desc = toolDescriptions[tool];
  return desc ? desc() : `Execute ${tool} with provided parameters`;
}
