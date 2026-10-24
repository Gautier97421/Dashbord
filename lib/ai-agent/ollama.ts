/**
 * Ollama client — real local LLM integration
 *
 * Talks to a local Ollama server (default http://localhost:11434).
 * Configure with env vars:
 *   - OLLAMA_BASE_URL (default "http://localhost:11434")
 *   - OLLAMA_MODEL    (default "qwen3:latest")
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:latest';
const DEFAULT_TIMEOUT_MS = 120000;

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
  /** Base64 images (without data: prefix), for vision models */
  images?: string[];
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface OllamaToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Low-level chat call to Ollama. Supports optional tool specs for tool-calling.
 */
export async function ollamaChat(
  messages: OllamaMessage[],
  options: {
    tools?: OllamaToolSpec[];
    /** 'json' or a JSON schema for structured output */
    format?: 'json' | Record<string, any>;
    temperature?: number;
    timeoutMs?: number;
    model?: string;
    /** How long the model stays loaded after the call (e.g. "15m") */
    keepAlive?: string;
  } = {}
): Promise<OllamaMessage> {
  const body: Record<string, any> = {
    model: options.model ?? OLLAMA_MODEL,
    messages,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.2,
    },
  };

  if (options.keepAlive) {
    body.keep_alive = options.keepAlive;
  }

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
  }
  if (options.format) {
    body.format = options.format;
  }

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Ollama API error: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
  }

  const data = await res.json();
  return data.message as OllamaMessage;
}

/**
 * Load a model into memory without generating anything, so the next real call starts fast.
 */
export async function ollamaPreload(model: string, keepAlive: string): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [], keep_alive: keepAlive }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
  }
}

export const ollamaConfig = {
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
};
