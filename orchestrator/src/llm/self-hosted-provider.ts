import OpenAI from 'openai';
import { encoding_for_model, get_encoding } from 'tiktoken';
import type { ILLMProvider, LlmChatMessage, LlmCompletionResult, LlmToolDefinition } from './types';
import { toOpenAIMessages } from './openai-messages';
import { streamOpenAICompletion } from './openai-stream';

function estimateTokens(input: string): number {
  try {
    const enc = encoding_for_model('gpt-4o-mini');
    const tokens = enc.encode(input).length;
    enc.free();
    return tokens;
  } catch {
    const fallback = get_encoding('cl100k_base');
    const tokens = fallback.encode(input).length;
    fallback.free();
    return tokens;
  }
}

export class SelfHostedProvider implements ILLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const baseURL = process.env.SELF_HOSTED_LLM_URL;
    if (!baseURL) {
      throw new Error('SELF_HOSTED_LLM_URL is required for self-hosted provider');
    }

    this.model = process.env.SELF_HOSTED_MODEL || 'llama3.1';
    this.client = new OpenAI({
      baseURL,
      apiKey: process.env.SELF_HOSTED_LLM_API_KEY || 'local',
      defaultHeaders: {
        ...(process.env.SELF_HOSTED_LLM_HTTP_REFERER
          ? { 'HTTP-Referer': process.env.SELF_HOSTED_LLM_HTTP_REFERER }
          : {}),
        ...(process.env.SELF_HOSTED_LLM_X_TITLE
          ? { 'X-Title': process.env.SELF_HOSTED_LLM_X_TITLE }
          : {}),
      },
    });
  }

  async complete(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
  ): Promise<LlmCompletionResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: toOpenAIMessages(messages),
      tools: tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
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

    const promptTokens =
      response.usage?.prompt_tokens ||
      estimateTokens(messages.map((m) => `${m.role}:${m.content}`).join('\n'));
    const completionTokens =
      response.usage?.completion_tokens ||
      estimateTokens(choice?.content || JSON.stringify(toolCalls));

    return {
      text: choice?.content || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      promptTokens,
      completionTokens,
      modelUsed: this.model,
      isEstimated: !response.usage,
    };
  }

  async completeStream(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
    onTextDelta: (delta: string) => void,
  ): Promise<LlmCompletionResult> {
    const result = await streamOpenAICompletion(
      this.client,
      this.model,
      messages,
      tools,
      onTextDelta,
    );
    if (result.isEstimated) {
      // Endpoint reported no usage in the stream; estimate with tiktoken.
      return {
        ...result,
        promptTokens:
          result.promptTokens ||
          estimateTokens(messages.map((m) => `${m.role}:${m.content}`).join('\n')),
        completionTokens:
          result.completionTokens ||
          estimateTokens(result.text || JSON.stringify(result.toolCalls || [])),
      };
    }
    return result;
  }
}
