import type OpenAI from 'openai';
import type {
  LlmChatMessage,
  LlmCompletionResult,
  LlmToolDefinition,
  NormalizedToolCall,
} from './types';
import { toOpenAIMessages } from './openai-messages';

export async function streamOpenAICompletion(
  client: OpenAI,
  model: string,
  messages: LlmChatMessage[],
  tools: LlmToolDefinition[],
  onTextDelta: (delta: string) => void,
): Promise<LlmCompletionResult> {
  const toolParams =
    tools.length > 0
      ? {
          tools: tools.map((tool) => ({
            type: 'function' as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema,
            },
          })),
          tool_choice: 'auto' as const,
        }
      : {};

  const stream = await client.chat.completions.create({
    model,
    messages: toOpenAIMessages(messages),
    ...toolParams,
    temperature: Number(process.env.LLM_TEMPERATURE ?? 0),
    stream: true,
    stream_options: { include_usage: true },
  });

  let text = '';
  const toolCallsInProgress = new Map<number, { id: string; name: string; argsJson: string }>();
  let promptTokens = 0;
  let completionTokens = 0;
  let sawUsage = false;

  for await (const chunk of stream) {
    if (chunk.usage) {
      promptTokens = chunk.usage.prompt_tokens || 0;
      completionTokens = chunk.usage.completion_tokens || 0;
      sawUsage = true;
    }

    const delta = chunk.choices[0]?.delta;
    if (!delta) {
      continue;
    }

    if (delta.content) {
      text += delta.content;
      onTextDelta(delta.content);
    }

    for (const tc of delta.tool_calls || []) {
      const entry = toolCallsInProgress.get(tc.index) || { id: '', name: '', argsJson: '' };
      if (tc.id) {
        entry.id = tc.id;
      }
      if (tc.function?.name) {
        entry.name += tc.function.name;
      }
      if (tc.function?.arguments) {
        entry.argsJson += tc.function.arguments;
      }
      toolCallsInProgress.set(tc.index, entry);
    }
  }

  const toolCalls: NormalizedToolCall[] = [...toolCallsInProgress.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, entry]) => ({
      id: entry.id || `tool-call-${index}`,
      name: entry.name,
      arguments: JSON.parse(entry.argsJson || '{}') as Record<string, unknown>,
    }));

  return {
    text: text || undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    promptTokens,
    completionTokens,
    modelUsed: model,
    isEstimated: !sawUsage,
  };
}
