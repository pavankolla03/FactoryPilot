import Anthropic from '@anthropic-ai/sdk';
import type { ILLMProvider, LlmChatMessage, LlmCompletionResult, LlmToolDefinition } from './types';

function normalizeAnthropicSchema(inputSchema: Record<string, unknown>) {
  if (inputSchema.type === 'object') {
    return inputSchema as {
      type: 'object';
      properties?: Record<string, unknown>;
      additionalProperties?: boolean;
    };
  }

  return {
    type: 'object',
    properties: inputSchema,
    additionalProperties: true,
  };
}

export class AnthropicProvider implements ILLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider');
    }
    this.model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async complete(messages: LlmChatMessage[], tools: LlmToolDefinition[]): Promise<LlmCompletionResult> {
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const nonSystem = messages.filter((m) => m.role !== 'system');
    const anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: normalizeAnthropicSchema(t.inputSchema),
    })) as Array<{ name: string; description: string; input_schema: { type: 'object'; properties?: Record<string, unknown>; additionalProperties?: boolean } }>;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1200,
      system,
      messages: nonSystem.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      tools: anthropicTools,
    });

    const toolCalls = response.content
      .filter((c) => c.type === 'tool_use')
      .map((c) => ({
        id: c.id,
        name: c.name,
        arguments: c.input as Record<string, unknown>,
      }));

    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    return {
      text: text || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      modelUsed: this.model,
      isEstimated: false,
    };
  }
}
