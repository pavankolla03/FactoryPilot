import OpenAI from 'openai';
import type { ILLMProvider, LlmChatMessage, LlmCompletionResult, LlmToolDefinition } from './types';
import { toOpenAIMessages } from './openai-messages';
import { streamOpenAICompletion } from './openai-stream';

export class AzureOpenAIProvider implements ILLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;

    if (!endpoint || !apiKey) {
      throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are required');
    }

    this.model = process.env.AZURE_OPENAI_MODEL || 'gpt-4o-mini';
    this.client = new OpenAI({
      apiKey,
      baseURL: `${endpoint}/openai/deployments/${this.model}`,
      defaultQuery: { 'api-version': '2024-06-01' },
      defaultHeaders: { 'api-key': apiKey },
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

    return {
      text: choice?.content || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      modelUsed: this.model,
      isEstimated: false,
    };
  }

  async completeStream(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
    onTextDelta: (delta: string) => void,
  ): Promise<LlmCompletionResult> {
    return streamOpenAICompletion(this.client, this.model, messages, tools, onTextDelta);
  }
}
