/**
 * AI Engine
 * Real LLM integration (Claude online, local Ollama otherwise — see lib/ai/llm.ts).
 * Falls back to a keyword heuristic if the AI is unavailable.
 */

import { AIContext, AIResponse, ToolDefinition } from './types';
import { chooseTool, isAiAvailable, type ToolChoiceSpec } from '@/lib/ai/llm';

export class AIEngine {
  /**
   * Process a user request and return a tool-call suggestion.
   */
  async processRequest(context: AIContext): Promise<AIResponse> {
    const available = await isAiAvailable('email');
    if (!available) {
      // No AI configured / reachable — degrade gracefully to a keyword heuristic
      return this.heuristicResponse(context);
    }

    try {
      return await this.aiResponse(context);
    } catch (error) {
      console.error('AI processRequest failed, falling back to heuristic:', error);
      return this.heuristicResponse(context);
    }
  }

  /**
   * Let the AI pick the right tool and parameters.
   */
  private async aiResponse(context: AIContext): Promise<AIResponse> {
    const systemPrompt = [
      'You are an email assistant that helps the user manage their Gmail inbox.',
      'When the user asks you to do something, choose exactly ONE tool from the provided list',
      'and fill in its parameters using valid Gmail search syntax (e.g. "is:unread", "from:x@y.com", "category:promotions").',
      'Always call a tool. Do not answer in plain text.',
    ].join(' ');

    const chosen = await chooseTool(systemPrompt, context.request, this.toToolSpecs(context.availableTools), 'email');
    if (!chosen) {
      // Model answered without a tool call — fall back
      return this.heuristicResponse(context);
    }

    return { tool: chosen.name, params: chosen.input, reasoning: chosen.reasoning };
  }

  /**
   * Convert internal tool definitions to provider-neutral tool specs (JSON schema parameters).
   */
  private toToolSpecs(tools: ToolDefinition[]): ToolChoiceSpec[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: Object.fromEntries(
          Object.entries(tool.params).map(([key, def]) => [
            key,
            {
              type: def.type === 'number' ? 'number' : 'string',
              description: def.description,
              ...(def.enum ? { enum: def.enum } : {}),
            },
          ])
        ),
        required: Object.keys(tool.params).filter((k) => tool.params[k].required),
      },
    }));
  }

  /**
   * Keyword fallback used when the AI is unavailable.
   */
  private heuristicResponse(context: AIContext): AIResponse {
    const request = context.request.toLowerCase();

    if (request.includes('organize') || request.includes('label') || request.includes('trie') || request.includes('range')) {
      return {
        tool: 'gmail.labelEmails',
        params: { filter: 'is:unread', label: 'Inbox', maxResults: 50 },
        reasoning: '(fallback) User wants to organize emails.',
      };
    }

    if (request.includes('archive') || request.includes('move') || request.includes('déplace')) {
      return {
        tool: 'gmail.moveEmails',
        params: { filter: 'is:old -is:starred', targetLabel: 'Archive', maxResults: 100 },
        reasoning: '(fallback) User wants to archive emails.',
      };
    }

    return {
      tool: 'gmail.readEmails',
      params: { filter: 'is:unread', maxResults: 20 },
      reasoning: '(fallback) Defaulting to reading unread emails.',
    };
  }

  /**
   * Validate AI response against available tools.
   */
  validateResponse(response: AIResponse, availableTools: ToolDefinition[]): void {
    const tool = availableTools.find((t) => t.name === response.tool);
    if (!tool) {
      throw new Error(`Tool "${response.tool}" not found in available tools`);
    }

    for (const [paramName, paramDef] of Object.entries(tool.params)) {
      if (paramDef.required && !(paramName in response.params)) {
        throw new Error(`Required parameter "${paramName}" missing in tool response`);
      }
    }
  }
}
