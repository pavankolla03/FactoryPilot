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

function toAnthropicMessages(messages: LlmChatMessage[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      continue;
    }

    if (m.role === 'assistant' && m.toolCalls?.length) {
      const content: Anthropic.Messages.ContentBlockParam[] = [];
      if (m.content) {
        content.push({ type: 'text', text: m.content });
      }
      for (const tc of m.toolCalls) {
        content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
      }
      result.push({ role: 'assistant', content });
      continue;
    }

    if (m.role === 'tool') {
      const block: Anthropic.Messages.ToolResultBlockParam = {
        type: 'tool_result',
        tool_use_id: m.toolCallId || 'tool-call',
        content: m.content,
      };
      const last = result[result.length - 1];
      // Anthropic requires all tool_results for a turn in one user message.
      if (
        last &&
        last.role === 'user' &&
        Array.isArray(last.content) &&
        last.content[0]?.type === 'tool_result'
      ) {
        (last.content as Anthropic.Messages.ContentBlockParam[]).push(block);
      } else {
        result.push({ role: 'user', content: [block] });
      }
      continue;
    }

    result.push({ role: m.role, content: m.content });
  }

  return result;
}

export class AnthropicProvider implements ILLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider');
    }
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async complete(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
  ): Promise<LlmCompletionResult> {
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: normalizeAnthropicSchema(t.inputSchema),
    })) as Array<{
      name: string;
      description: string;
      input_schema: {
        type: 'object';
        properties?: Record<string, unknown>;
        additionalProperties?: boolean;
      };
    }>;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1200,
      system,
      messages: toAnthropicMessages(messages),
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

  async completeStream(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
    onTextDelta: (delta: string) => void,
  ): Promise<LlmCompletionResult> {
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: normalizeAnthropicSchema(t.inputSchema),
    })) as Anthropic.Messages.Tool[];

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 1200,
      system,
      messages: toAnthropicMessages(messages),
      tools: anthropicTools,
    });

    stream.on('text', (delta) => onTextDelta(delta));

    const response = await stream.finalMessage();

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
