import OpenAI from 'openai';
import { Logger } from '@nestjs/common';
import type { ILLMProvider, LlmChatMessage, LlmCompletionResult, LlmToolDefinition } from './types';
import { toOpenAIMessages } from './openai-messages';
import { streamOpenAICompletion } from './openai-stream';

export interface UserModelConfig {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  apiKey: string;
}

/**
 * BYOM (beta, Phase M): a single user-registered, OpenAI-compatible model
 * endpoint (OpenAI, Azure, Groq, Ollama, vLLM, OpenRouter, ...). The
 * modelUsed is reported as "name (modelId)" so metering and the quality
 * ledger attribute answers to the user's model, not the platform chain.
 */
class CustomModelProvider implements ILLMProvider {
  private readonly client: OpenAI;

  constructor(private readonly cfg: UserModelConfig) {
    this.client = new OpenAI({ baseURL: cfg.baseUrl, apiKey: cfg.apiKey });
  }

  get label(): string {
    return `${this.cfg.name} (${this.cfg.modelId})`;
  }

  async complete(messages: LlmChatMessage[], tools: LlmToolDefinition[]): Promise<LlmCompletionResult> {
    const toolParams =
      tools.length > 0
        ? {
            tools: tools.map((tool) => ({
              type: 'function' as const,
              function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
            })),
            tool_choice: 'auto' as const,
          }
        : {};
    const response = await this.client.chat.completions.create({
      model: this.cfg.modelId,
      messages: toOpenAIMessages(messages),
      temperature: Number(process.env.LLM_TEMPERATURE ?? 0),
      ...toolParams,
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
      modelUsed: this.label,
      isEstimated: !response.usage,
    };
  }

  async completeStream(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
    onTextDelta: (delta: string) => void,
  ): Promise<LlmCompletionResult> {
    const result = await streamOpenAICompletion(this.client, this.cfg.modelId, messages, tools, onTextDelta);
    return { ...result, modelUsed: this.label };
  }
}

/**
 * Routes to the user's own models first (in their configured order) and falls
 * back to the platform provider when a custom endpoint errors — the user's
 * key never blocks them from getting an answer.
 */
export class UserRoutedProvider implements ILLMProvider {
  private readonly logger = new Logger(UserRoutedProvider.name);
  private readonly customs: CustomModelProvider[];

  constructor(
    models: UserModelConfig[],
    private readonly platform: ILLMProvider,
  ) {
    this.customs = models.map((m) => new CustomModelProvider(m));
  }

  private async withRouting<T>(
    viaCustom: (p: CustomModelProvider) => Promise<T>,
    viaPlatform: () => Promise<T>,
  ): Promise<T> {
    for (const custom of this.customs) {
      try {
        return await viaCustom(custom);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`Custom model ${custom.label} failed (${reason}); falling back`);
      }
    }
    return viaPlatform();
  }

  complete(messages: LlmChatMessage[], tools: LlmToolDefinition[]): Promise<LlmCompletionResult> {
    return this.withRouting(
      (p) => p.complete(messages, tools),
      () => this.platform.complete(messages, tools),
    );
  }

  completeStream(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
    onTextDelta: (delta: string) => void,
  ): Promise<LlmCompletionResult> {
    return this.withRouting(
      (p) =>
        p.completeStream
          ? p.completeStream(messages, tools, onTextDelta)
          : p.complete(messages, tools),
      () =>
        this.platform.completeStream
          ? this.platform.completeStream(messages, tools, onTextDelta)
          : this.platform.complete(messages, tools),
    );
  }
}
