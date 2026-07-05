export interface LlmToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
}

export interface NormalizedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmCompletionResult {
  text?: string;
  toolCalls?: NormalizedToolCall[];
  promptTokens: number;
  completionTokens: number;
  modelUsed: string;
  isEstimated?: boolean;
}

export interface ILLMProvider {
  complete(messages: LlmChatMessage[], tools: LlmToolDefinition[]): Promise<LlmCompletionResult>;
}
