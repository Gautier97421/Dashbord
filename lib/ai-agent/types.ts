/**
 * Core type definitions for the AI agent system
 */

/**
 * A tool that the AI can call
 * Example: { tool: "gmail.labelEmails", params: { query: "...", label: "..." } }
 */
export interface ToolCall {
  tool: string;
  params: Record<string, any>;
}

/**
 * Response from the AI engine
 */
export interface AIResponse {
  tool: string;
  params: Record<string, any>;
  reasoning?: string; // Optional explanation from AI
}

/**
 * Tool definition - describes what a tool does and what parameters it needs
 */
export interface ToolDefinition {
  name: string;
  description: string;
  params: {
    [key: string]: {
      type: string;
      description: string;
      required?: boolean;
      enum?: string[];
    };
  };
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Context sent to AI engine
 */
export interface AIContext {
  request: string;
  availableTools: ToolDefinition[];
  userContext?: Record<string, any>;
}

/**
 * AI Suggestion stored in database
 */
export interface AISuggestionRecord {
  id: string;
  userId: string;
  requestText: string;
  tool: string;
  params: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  result?: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
  confirmedAt?: Date;
  executedAt?: Date;
}

/**
 * Action log entry
 */
export interface ActionLogRecord {
  id: string;
  userId: string;
  actionType: string;
  status: 'success' | 'failed';
  input: Record<string, any>;
  output?: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
}
