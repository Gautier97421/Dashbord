/**
 * Re-export tool types from AI agent types
 * This maintains the module structure and allows base.ts to import from './types'
 */

export type { ToolDefinition, ToolExecutionResult } from '../ai-agent/types';
