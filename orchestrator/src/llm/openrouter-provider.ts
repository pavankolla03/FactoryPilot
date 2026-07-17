import OpenAI from 'openai';
import { Logger } from '@nestjs/common';
import type { ILLMProvider, LlmChatMessage, LlmCompletionResult, LlmToolDefinition } from './types';
import { toOpenAIMessages } from './openai-messages';
import { streamOpenAICompletion } from './openai-stream';

/**
 * Preferred order for free tool-calling models. Anything discovered from the
 * live model list that supports tools at $0 is appended after these.
 */
const PREFERRED_FREE_MODELS = [
  'poolside/laguna-m.1:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-20b:free',
];

const COOLDOWN_MS = 10 * 60 * 1000;

/** Smaller/faster free models used for simple lookups (cost/latency routing). */
const DEFAULT_LIGHT_MODELS = ['nvidia/nemotron-nano-9b-v2:free', 'openai/gpt-oss-20b:free'];

const COMPLEX_HINTS = /analy|compare|why|trend|summar|explain|report|handover|suggest|reorder|prepare|workflow|forecast/i;

function isSimpleQuery(messages: { role: string; content: string }[]): boolean {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) {
    return false;
  }
  return lastUser.content.length < 120 && !COMPLEX_HINTS.test(lastUser.content);
}

export class OpenRouterProvider implements ILLMProvider {
  private readonly logger = new Logger(OpenRouterProvider.name);
  private readonly client: OpenAI;
  private chain: string[] = [];
  private readonly cooldownUntil = new Map<string, number>();
  private discovery: Promise<void> | null = null;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required for the openrouter provider');
    }

    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://factorypilot.local',
        'X-Title': 'FactoryPilot',
      },
    });

    const pinned = (process.env.OPENROUTER_MODELS || '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    if (pinned.length > 0) {
      this.chain = pinned;
    }
  }

  private async ensureChain() {
    if (this.chain.length > 0) {
      return;
    }
    this.discovery ??= this.discoverModels();
    await this.discovery;
  }

  private async discoverModels() {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      const body = (await res.json()) as {
        data?: Array<{
          id: string;
          pricing?: { prompt?: string; completion?: string };
          supported_parameters?: string[];
        }>;
      };

      const freeToolModels = (body.data || [])
        .filter(
          (m) =>
            Number(m.pricing?.prompt || 0) === 0 &&
            Number(m.pricing?.completion || 0) === 0 &&
            (m.supported_parameters || []).includes('tools'),
        )
        .map((m) => m.id);

      const preferred = PREFERRED_FREE_MODELS.filter((m) => freeToolModels.includes(m));
      const rest = freeToolModels.filter((m) => !preferred.includes(m));
      this.chain = [...preferred, ...rest];
      this.logger.log(`OpenRouter chain: ${this.chain.slice(0, 5).join(' → ')} (+${Math.max(0, this.chain.length - 5)} more)`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Model discovery failed (${reason}); falling back to preferred list`);
      this.chain = [...PREFERRED_FREE_MODELS];
    }

    if (this.chain.length === 0) {
      this.chain = [...PREFERRED_FREE_MODELS];
    }
  }

  private candidates(light: boolean): string[] {
    const now = Date.now();
    let ordered = this.chain;

    if (light) {
      const lightModels = (process.env.OPENROUTER_LIGHT_MODELS || DEFAULT_LIGHT_MODELS.join(','))
        .split(',')
        .map((m) => m.trim())
        .filter((m) => this.chain.includes(m));
      ordered = [...lightModels, ...this.chain.filter((m) => !lightModels.includes(m))];
    }

    const available = ordered.filter((m) => (this.cooldownUntil.get(m) || 0) <= now);
    return available.length > 0 ? available : ordered;
  }

  private async withFallback<T>(light: boolean, fn: (model: string) => Promise<T>): Promise<T> {
    await this.ensureChain();
    let lastError: unknown = new Error('no OpenRouter models available');

    for (const model of this.candidates(light).slice(0, 4)) {
      try {
        return await fn(model);
      } catch (error) {
        lastError = error;
        this.cooldownUntil.set(model, Date.now() + COOLDOWN_MS);
        const reason = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`Model ${model} failed (${reason}); trying next in chain`);
      }
    }

    throw lastError;
  }

  async complete(messages: LlmChatMessage[], tools: LlmToolDefinition[]): Promise<LlmCompletionResult> {
    return this.withFallback(isSimpleQuery(messages), async (model) => {
      const response = await this.client.chat.completions.create({
        model,
        messages: toOpenAIMessages(messages),
        tools: tools.map((tool) => ({
          type: 'function' as const,
          function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
        })),
        tool_choice: 'auto',
        temperature: Number(process.env.LLM_TEMPERATURE ?? 0),
      });

      const choice = response.choices[0]?.message;
      const toolCalls =
        choice?.tool_calls?.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>,
        })) || [];

      return {
        text: choice?.content || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        modelUsed: model,
        isEstimated: !response.usage,
      };
    });
  }

  async completeStream(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
    onTextDelta: (delta: string) => void,
  ): Promise<LlmCompletionResult> {
    return this.withFallback(isSimpleQuery(messages), (model) =>
      streamOpenAICompletion(this.client, model, messages, tools, onTextDelta),
    );
  }
}
