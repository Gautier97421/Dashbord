/**
 * Fournisseur d'IA de l'app : Claude (API Anthropic) pour la version en ligne, Ollama (modèle local
 * sur le PC) pour la version locale. Choix via AI_PROVIDER=claude|ollama ; par défaut Claude dès
 * qu'une clé ANTHROPIC_API_KEY est configurée, sinon Ollama.
 *
 * Variables : ANTHROPIC_API_KEY, ANTHROPIC_MODEL (défaut claude-haiku-5-5),
 *             OLLAMA_BASE_URL, OLLAMA_MODEL (texte), OLLAMA_VISION_MODEL (images).
 */
import Anthropic from '@anthropic-ai/sdk';
import { ollamaChat, ollamaConfig, ollamaPreload, type OllamaToolSpec } from '@/lib/ai-agent/ollama';

export type AiProvider = 'claude' | 'ollama';
type Effort = 'low' | 'medium' | 'high';

// Haiku : rapide et peu coûteux, suffisant pour lire une photo de plat ou une étiquette
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'qwen2.5vl:7b';
const OLLAMA_KEEP_ALIVE = '15m';

// Refus du modèle (filtres de sécurité) : sur les modèles qui le permettent, la requête est rejouée côté
// serveur sur le modèle de repli conseillé. Haiku n'a pas de repli : il ne faut pas envoyer le paramètre.
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);
const fallbackParams = () =>
  FALLBACK_MODELS.has(CLAUDE_MODEL)
    ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
    : {};

export function aiProvider(): AiProvider {
  const configured = process.env.AI_PROVIDER;
  if (configured === 'claude' || configured === 'ollama') return configured;
  return process.env.ANTHROPIC_API_KEY ? 'claude' : 'ollama';
}

/**
 * "email" : tout ce qui contient le contenu de tes mails (tri, rendez-vous, candidatures, factures
 * jointes, demandes à l'agent). "general" : le reste (photos de plats, étiquettes).
 */
export type AiPurpose = 'general' | 'email';

/**
 * Confidentialité : le contenu des mails n'est jamais envoyé à un service externe par défaut.
 * AI_EMAIL_PROVIDER=ollama (IA locale) | claude (envoi à l'API Anthropic, à activer sciemment) | none.
 * Sans réglage : Ollama si c'est l'IA de l'app (local), sinon aucune IA (l'agent passe en règles locales).
 */
function providerFor(purpose: AiPurpose): AiProvider | 'none' {
  const base = aiProvider();
  if (purpose !== 'email') return base;
  const configured = process.env.AI_EMAIL_PROVIDER;
  if (configured === 'claude' || configured === 'ollama' || configured === 'none') return configured;
  return base === 'ollama' ? 'ollama' : 'none';
}

const EMAIL_AI_DISABLED = "L'IA est désactivée pour les mails (confidentialité) : règles locales utilisées.";

/** Erreur d'IA exploitable par les routes (message clair pour l'utilisateur). */
export class AiError extends Error {
  constructor(
    public code: 'not_configured' | 'auth' | 'rate_limit' | 'unavailable' | 'timeout' | 'refusal' | 'invalid_output' | 'model_missing',
    message: string
  ) {
    super(message);
    this.name = 'AiError';
  }
}

let claudeClient: Anthropic | null = null;
function claude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiError('not_configured', "L'IA en ligne n'est pas configurée (clé ANTHROPIC_API_KEY manquante).");
  }
  // timeout en millisecondes ; le SDK réessaie déjà 2 fois sur 429 / 5xx / coupure réseau
  claudeClient ??= new Anthropic({ timeout: 90_000, maxRetries: 2 });
  return claudeClient;
}

/** Traduit les erreurs du SDK Anthropic et d'Ollama en AiError. */
function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiError('auth', "La clé de l'API Claude est invalide ou n'a pas accès à ce modèle.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError('rate_limit', "Trop de demandes à l'IA pour le moment. Réessaie dans une minute.");
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiError('timeout', "L'IA a mis trop de temps à répondre. Réessaie.");
  }
  if (error instanceof Anthropic.APIConnectionError || (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500)) {
    return new AiError('unavailable', "Le service d'IA est momentanément indisponible. Réessaie plus tard.");
  }
  if (error instanceof Anthropic.APIError) {
    return new AiError('unavailable', `Erreur de l'API Claude (${error.status}).`);
  }
  // Ollama (fetch)
  const err = error as { name?: string; message?: string; cause?: { code?: string } };
  const msg = String(err?.message || '');
  if (err?.name === 'TimeoutError') return new AiError('timeout', "L'analyse a pris trop de temps. Réessaie.");
  if (/not found|404/i.test(msg)) return new AiError('model_missing', `Modèle Ollama non installé (${msg}).`);
  if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(msg) || err?.cause?.code === 'ECONNREFUSED') {
    return new AiError('unavailable', `Ollama est injoignable (${ollamaConfig.baseUrl}). Vérifie qu'il est démarré.`);
  }
  return new AiError('unavailable', msg || "Erreur de l'IA");
}

export interface ImageInput {
  /** Base64 sans préfixe data: */
  data: string;
  mediaType?: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
}

/** Type d'image d'après ses premiers octets (les photos du scan sont en JPEG). */
function detectMediaType(base64: string): NonNullable<ImageInput['mediaType']> {
  const head = Buffer.from(base64.slice(0, 16), 'base64');
  if (head[0] === 0x89 && head[1] === 0x50) return 'image/png';
  if (head[0] === 0x47 && head[1] === 0x49) return 'image/gif';
  if (head[0] === 0x52 && head[1] === 0x49) return 'image/webp';
  return 'image/jpeg';
}

export interface GenerateJsonOptions {
  system: string;
  prompt: string;
  /** Schéma JSON de la réponse (objets avec additionalProperties: false et tous les champs requis). */
  schema: Record<string, unknown>;
  images?: ImageInput[];
  /** Effort de Claude : "low" pour les extractions simples (défaut), plus haut pour le raisonnement. */
  effort?: Effort;
  timeoutMs?: number;
  /** "email" dès que le texte ou les images viennent d'un mail (voir providerFor) */
  purpose?: AiPurpose;
}

/** Réponse JSON conforme au schéma, à partir d'un texte et éventuellement d'images. */
export async function generateJSON<T>(options: GenerateJsonOptions): Promise<T> {
  const provider = providerFor(options.purpose ?? 'general');
  if (provider === 'none') throw new AiError('not_configured', EMAIL_AI_DISABLED);
  try {
    return provider === 'claude' ? await claudeJSON<T>(options) : await ollamaJSONWithSchema<T>(options);
  } catch (error) {
    throw toAiError(error);
  }
}

async function claudeJSON<T>({ system, prompt, schema, images = [], effort = 'low', timeoutMs }: GenerateJsonOptions): Promise<T> {
  const response = await claude().beta.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      system,
      ...fallbackParams(),
      output_config: { effort, format: { type: 'json_schema', schema } },
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((image) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: image.mediaType ?? detectMediaType(image.data), data: image.data },
            })),
            { type: 'text' as const, text: prompt },
          ],
        },
      ],
    },
    timeoutMs ? { timeout: timeoutMs } : undefined
  );

  if (response.stop_reason === 'refusal') {
    throw new AiError('refusal', "L'IA a refusé de traiter cette demande.");
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AiError('invalid_output', "La réponse de l'IA a été coupée.");
  }
  const text = response.content.find((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')?.text;
  if (!text) throw new AiError('invalid_output', "L'IA n'a pas renvoyé de réponse.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError('invalid_output', "La réponse de l'IA n'est pas un JSON valide.");
  }
}

async function ollamaJSONWithSchema<T>({ system, prompt, schema, images = [], timeoutMs }: GenerateJsonOptions): Promise<T> {
  const message = await ollamaChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: prompt, ...(images.length ? { images: images.map((i) => i.data) } : {}) },
    ],
    {
      format: schema,
      temperature: 0,
      timeoutMs: timeoutMs ?? 180_000,
      ...(images.length ? { model: OLLAMA_VISION_MODEL, keepAlive: OLLAMA_KEEP_ALIVE } : {}),
    }
  );
  const raw = (message.content || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : raw) as T;
  } catch {
    throw new AiError('invalid_output', "La réponse de l'IA n'est pas un JSON valide.");
  }
}

/** Prépare le modèle d'images (Ollama : chargement en mémoire ; Claude : rien à faire). */
export async function warmUpVision(): Promise<void> {
  if (aiProvider() !== 'ollama') return;
  try {
    await ollamaPreload(OLLAMA_VISION_MODEL, OLLAMA_KEEP_ALIVE);
  } catch (error) {
    throw toAiError(error);
  }
}

/** L'IA peut-elle répondre ? (clé configurée pour Claude, serveur joignable pour Ollama) */
export async function isAiAvailable(purpose: AiPurpose = 'general'): Promise<boolean> {
  const provider = providerFor(purpose);
  if (provider === 'none') return false;
  if (provider === 'claude') return !!process.env.ANTHROPIC_API_KEY;
  try {
    const res = await fetch(`${ollamaConfig.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ToolChoiceSpec {
  name: string;
  description: string;
  /** Schéma JSON des paramètres de l'outil */
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export interface ChosenTool {
  name: string;
  input: Record<string, unknown>;
  reasoning: string;
}

// Claude n'accepte que [a-zA-Z0-9_-] dans les noms d'outils ("gmail.readEmails" -> "gmail__readEmails")
const toClaudeToolName = (name: string) => name.replace(/\./g, '__');
const fromClaudeToolName = (name: string) => name.replace(/__/g, '.');

/** L'IA choisit un outil et ses paramètres pour une demande ; null si elle n'en choisit aucun. */
export async function chooseTool(
  system: string,
  request: string,
  tools: ToolChoiceSpec[],
  purpose: AiPurpose = 'general'
): Promise<ChosenTool | null> {
  const provider = providerFor(purpose);
  if (provider === 'none') throw new AiError('not_configured', EMAIL_AI_DISABLED);
  try {
    if (provider === 'claude') {
      // Choix d'outil forcé indisponible sur ce modèle : "auto" + consigne explicite dans le prompt système
      const response = await claude().beta.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        system,
        ...fallbackParams(),
        output_config: { effort: 'low' },
        tool_choice: { type: 'auto', disable_parallel_tool_use: true },
        tools: tools.map((tool) => ({
          name: toClaudeToolName(tool.name),
          description: tool.description,
          input_schema: tool.parameters,
        })),
        messages: [{ role: 'user', content: request }],
      });
      if (response.stop_reason === 'refusal') throw new AiError('refusal', "L'IA a refusé de traiter cette demande.");
      const call = response.content.find((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use');
      if (!call) return null;
      const text = response.content.find((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')?.text;
      return {
        name: fromClaudeToolName(call.name),
        input: (call.input as Record<string, unknown>) || {},
        reasoning: text || 'Choisi par Claude',
      };
    }

    const ollamaTools: OllamaToolSpec[] = tools.map((tool) => ({
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters: tool.parameters as OllamaToolSpec['function']['parameters'] },
    }));
    const message = await ollamaChat(
      [
        { role: 'system', content: system },
        { role: 'user', content: request },
      ],
      { tools: ollamaTools, temperature: 0.1 }
    );
    const call = message.tool_calls?.[0];
    if (!call) return null;
    const args = typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments;
    return { name: call.function.name, input: args || {}, reasoning: message.content || 'Choisi par Ollama' };
  } catch (error) {
    throw toAiError(error);
  }
}
