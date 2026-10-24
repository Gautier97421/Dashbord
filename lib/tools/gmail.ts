/**
 * Gmail-specific tools for the AI agent
 * Defines available actions the AI can suggest
 */

import { Tool, ToolRegistry } from './base';
import { ToolDefinition, ToolExecutionResult } from '../ai-agent/types';
import { GmailClient } from '../gmail/client';
import { decrypt } from '../security/encryption';
import { prisma } from '../prisma';

/**
 * Tool: Read emails matching a filter
 */
export class ReadEmailsTool extends Tool {
  name = 'gmail.readEmails';
  description = 'Read emails matching a Gmail search filter (e.g., "is:unread", "from:sender@example.com")';

  definition: ToolDefinition = {
    name: 'gmail.readEmails',
    description: this.description,
    params: {
      filter: {
        type: 'string',
        description: 'Gmail search query (e.g., "is:unread", "from:boss@company.com", "subject:invoice")',
        required: true,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of emails to return (1-100, default 10)',
        required: false,
      },
    },
  };

  validate(params: Record<string, any>): void {
    if (!params.filter || typeof params.filter !== 'string') {
      throw new Error('filter parameter is required and must be a string');
    }
    if (params.maxResults && (typeof params.maxResults !== 'number' || params.maxResults < 1 || params.maxResults > 100)) {
      throw new Error('maxResults must be a number between 1 and 100');
    }
  }

  async execute(params: Record<string, any>, context: any): Promise<ToolExecutionResult> {
    try {
      const { filter, maxResults = 10 } = params;
      const { gmailClient } = context;

      if (!gmailClient) {
        return {
          success: false,
          error: 'Gmail client not provided in context',
        };
      }

      const result = await gmailClient.searchEmails({
        q: filter,
        maxResults,
      });

      return {
        success: true,
        data: {
          messageCount: result.resultSizeEstimate || 0,
          messageIds: result.messages?.map((m: { id: string }) => m.id) || [],
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

/**
 * Tool: Label emails
 */
export class LabelEmailsTool extends Tool {
  name = 'gmail.labelEmails';
  description = 'Apply a label to emails matching a filter';

  definition: ToolDefinition = {
    name: 'gmail.labelEmails',
    description: this.description,
    params: {
      filter: {
        type: 'string',
        description: 'Gmail search query to find emails to label',
        required: true,
      },
      label: {
        type: 'string',
        description: 'Label name to apply (e.g., "Important", "Work", "Personal")',
        required: true,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of emails to label (1-100, default 20)',
        required: false,
      },
    },
  };

  validate(params: Record<string, any>): void {
    if (!params.filter || typeof params.filter !== 'string') {
      throw new Error('filter parameter is required');
    }
    if (!params.label || typeof params.label !== 'string') {
      throw new Error('label parameter is required');
    }
  }

  async execute(params: Record<string, any>, context: any): Promise<ToolExecutionResult> {
    try {
      const { filter, label, maxResults = 20 } = params;
      const { gmailClient } = context;

      if (!gmailClient) {
        return {
          success: false,
          error: 'Gmail client not provided in context',
        };
      }

      // Find emails matching filter
      const searchResult = await gmailClient.searchEmails({
        q: filter,
        maxResults,
      });

      const messageIds = searchResult.messages?.map((m: { id: string }) => m.id) || [];
      if (messageIds.length === 0) {
        return {
          success: true,
          data: {
            appliedToCount: 0,
            message: 'No emails found matching the filter',
          },
        };
      }

      // Get or create label
      let labelData = await gmailClient.getLabelByName(label);
      if (!labelData) {
        labelData = await gmailClient.createLabel(label);
      }

      // Apply label
      await gmailClient.applyLabel(messageIds, labelData.id);

      return {
        success: true,
        data: {
          appliedToCount: messageIds.length,
          label,
          labelId: labelData.id,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

/**
 * Tool: Move emails to a label/folder
 */
export class MoveEmailsTool extends Tool {
  name = 'gmail.moveEmails';
  description = 'Move emails matching a filter to a specific label/folder';

  definition: ToolDefinition = {
    name: 'gmail.moveEmails',
    description: this.description,
    params: {
      filter: {
        type: 'string',
        description: 'Gmail search query to find emails to move',
        required: true,
      },
      targetLabel: {
        type: 'string',
        description: 'Target label/folder name (e.g., "Archive", "Spam", "Work")',
        required: true,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of emails to move (1-100, default 20)',
        required: false,
      },
    },
  };

  validate(params: Record<string, any>): void {
    if (!params.filter || typeof params.filter !== 'string') {
      throw new Error('filter parameter is required');
    }
    if (!params.targetLabel || typeof params.targetLabel !== 'string') {
      throw new Error('targetLabel parameter is required');
    }
  }

  async execute(params: Record<string, any>, context: any): Promise<ToolExecutionResult> {
    try {
      const { filter, targetLabel, maxResults = 20 } = params;
      const { gmailClient } = context;

      if (!gmailClient) {
        return {
          success: false,
          error: 'Gmail client not provided in context',
        };
      }

      // Find emails
      const searchResult = await gmailClient.searchEmails({
        q: filter,
        maxResults,
      });

      const messageIds = searchResult.messages?.map((m: { id: string }) => m.id) || [];
      if (messageIds.length === 0) {
        return {
          success: true,
          data: {
            movedCount: 0,
            message: 'No emails found matching the filter',
          },
        };
      }

      // Get or create target label
      let labelData = await gmailClient.getLabelByName(targetLabel);
      if (!labelData) {
        labelData = await gmailClient.createLabel(targetLabel);
      }

      // Move emails
      await gmailClient.moveEmails(messageIds, labelData.id);

      return {
        success: true,
        data: {
          movedCount: messageIds.length,
          targetLabel,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

/**
 * Initialize Gmail tools and register them
 */
export function initializeGmailTools(registry: ToolRegistry): void {
  registry.register(new ReadEmailsTool());
  registry.register(new LabelEmailsTool());
  registry.register(new MoveEmailsTool());
}
