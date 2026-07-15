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
  toolCalls?: NormalizedToolCall[];
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
  /**
   * Streaming variant: forwards assistant text chunks to onTextDelta as they
   * arrive, then resolves with the same normalized result as complete().
   */
  completeStream?(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
    onTextDelta: (delta: string) => void,
  ): Promise<LlmCompletionResult>;
}
