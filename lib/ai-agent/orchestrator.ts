/**
 * AI Orchestrator
 * Main controller that coordinates the entire AI agent flow
 */

import { AIEngine } from './engine';
import { toolRegistry } from '../tools/base';
import { getGmailClientForUser } from '../gmail/get-client';
import { prisma } from '../prisma';
import { AIResponse, AISuggestionRecord } from './types';

export class AIOrchestrator {
  private aiEngine: AIEngine;

  constructor(aiEngine?: AIEngine) {
    this.aiEngine = aiEngine || new AIEngine();
  }

  /**
   * Analyze user request and return AI suggestion
   * This is the main entry point
   *
   * Flow:
   * 1. Get user's Gmail credentials
   * 2. Send request to AI with available tools
   * 3. Validate AI response
   * 4. Save suggestion to database
   * 5. Return suggestion to user for confirmation
   */
  async analyze(userId: string, userRequest: string): Promise<AISuggestionRecord> {
    // 1. Verify the user has a Gmail account connected
    const oauthAccount = await prisma.oAuthAccount.findFirst({
      where: { userId, provider: 'gmail' },
    });

    if (!oauthAccount) {
      throw new Error('No Gmail account connected. Please authorize Gmail first.');
    }

    // 2. Prepare context for AI
    const availableTools = toolRegistry.getDefinitions();
    const aiContext = {
      request: userRequest,
      availableTools,
    };

    // 3. Call AI engine
    const aiResponse = await this.aiEngine.processRequest(aiContext);

    // 4. Validate response
    this.aiEngine.validateResponse(aiResponse, availableTools);

    // 5. Save suggestion to database
    const suggestion = await prisma.aISuggestion.create({
      data: {
        userId,
        requestText: userRequest,
        tool: aiResponse.tool,
        params: aiResponse.params,
        status: 'pending',
      },
    });

    return this.convertDbToRecord(suggestion);
  }

  /**
   * Execute an AI suggestion after user confirmation
   *
   * Flow:
   * 1. Fetch the suggestion from DB
   * 2. Validate suggestion is still pending
   * 3. Get user's Gmail client
   * 4. Execute the tool
   * 5. Log the action
   * 6. Update suggestion status
   * 7. Return result
   */
  async execute(userId: string, suggestionId: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    // 1. Fetch suggestion
    const suggestion = await prisma.aISuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      return {
        success: false,
        error: 'Suggestion not found',
      };
    }

    if (suggestion.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    // 2. Validate status
    if (suggestion.status !== 'approved') {
      return {
        success: false,
        error: `Suggestion status is ${suggestion.status}, not approved`,
      };
    }

    try {
      // 3. Get a Gmail client with a valid (auto-refreshed) token
      const gmailClient = await getGmailClientForUser(userId);

      // 4. Execute tool
      const context = { gmailClient };
      const toolResult = await toolRegistry.execute(suggestion.tool, suggestion.params as Record<string, any>, context);

      if (!toolResult.success) {
        // Log failed action
        const errorMessage = (toolResult as any).error || 'Unknown error';
        await prisma.actionLog.create({
          data: {
            userId,
            actionType: suggestion.tool,
            status: 'failed',
            input: (suggestion.params ?? {}) as any,
            errorMessage: errorMessage,
          },
        });

        // Update suggestion
        await prisma.aISuggestion.update({
          where: { id: suggestionId },
          data: {
            status: 'failed',
            errorMessage: errorMessage,
          },
        });

        return {
          success: false,
          error: errorMessage,
        };
      }

      // 5. Log successful action
      await prisma.actionLog.create({
        data: {
          userId,
          actionType: suggestion.tool,
          status: 'success',
          input: (suggestion.params ?? {}) as any,
          output: (toolResult.data ?? {}) as any,
        },
      });

      // 6. Update suggestion
      await prisma.aISuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'executed',
          result: (toolResult.data ?? {}) as any,
          executedAt: new Date(),
        },
      });

      // 7. Return result
      return {
        success: true,
        result: toolResult.data,
      };
    } catch (error: any) {
      // Log error
      await prisma.actionLog.create({
        data: {
          userId,
          actionType: suggestion.tool,
          status: 'failed',
          input: (suggestion.params ?? {}) as any,
          errorMessage: error.message,
        },
      });

      // Update suggestion
      await prisma.aISuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'failed',
          errorMessage: error.message,
        },
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user's action history
   */
  async getActionHistory(userId: string, limit: number = 50): Promise<Record<string, any>[]> {
    const logs = await prisma.actionLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs;
  }

  /**
   * Convert Prisma model to record type
   */
  private convertDbToRecord(dbRecord: Record<string, any>): AISuggestionRecord {
    return {
      id: dbRecord.id,
      userId: dbRecord.userId,
      requestText: dbRecord.requestText,
      tool: dbRecord.tool,
      params: dbRecord.params,
      status: dbRecord.status,
      result: dbRecord.result,
      errorMessage: dbRecord.errorMessage,
      createdAt: dbRecord.createdAt,
      confirmedAt: dbRecord.confirmedAt,
      executedAt: dbRecord.executedAt,
    };
  }
}

/**
 * Singleton instance
 */
export const aiOrchestrator = new AIOrchestrator();
