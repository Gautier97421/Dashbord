/**
 * Base class for all tools
 * Tools are reusable, modular actions that the AI can suggest
 */

import { ToolExecutionResult, ToolDefinition } from './types';

export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract definition: ToolDefinition;

  /**
   * Execute the tool with given parameters
   * Must validate inputs before execution
   */
  abstract execute(params: Record<string, any>, context?: any): Promise<ToolExecutionResult>;

  /**
   * Validate tool parameters
   * Throw error if invalid
   */
  abstract validate(params: Record<string, any>): void;
}

/**
 * Tool registry - manages all available tools
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if tool exists
   */
  exists(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tool definitions (for sending to AI)
   */
  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(tool => tool.definition);
  }

  /**
   * Execute a tool
   * Validates parameters and executes
   */
  async execute(toolName: string, params: Record<string, any>, context?: any): Promise<ToolExecutionResult> {
    const tool = this.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolName} not found in registry`,
      };
    }

    try {
      // Validate params
      tool.validate(params);

      // Execute
      const result = await tool.execute(params, context);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error during tool execution',
      };
    }
  }
}

/**
 * Global tool registry instance
 */
export const toolRegistry = new ToolRegistry();
