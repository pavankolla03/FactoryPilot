import { describe, expect, it } from 'vitest';
import { toOpenAIMessages } from './openai-messages';
import type { LlmChatMessage } from './types';

describe('OpenAI message conversion', () => {
  it('keeps the assistant tool-call turn ahead of tool results', () => {
    const history: LlmChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'show stock' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'getStockLevel',
            arguments: { materialId: 'MAT-1', warehouseId: '1010' },
          },
        ],
      },
      { role: 'tool', content: '{"qty":5}', toolCallId: 'call_1' },
    ];

    const converted = toOpenAIMessages(history);

    const assistant = converted[2] as {
      role: string;
      tool_calls?: Array<{ id: string; function: { name: string } }>;
    };
    expect(assistant.role).toBe('assistant');
    expect(assistant.tool_calls).toHaveLength(1);
    expect(assistant.tool_calls?.[0].id).toBe('call_1');
    expect(assistant.tool_calls?.[0].function.name).toBe('getStockLevel');

    const tool = converted[3] as { role: string; tool_call_id: string };
    expect(tool.role).toBe('tool');
    expect(tool.tool_call_id).toBe('call_1');
  });

  it('serializes tool-call arguments as JSON strings', () => {
    const converted = toOpenAIMessages([
      {
        role: 'assistant',
        content: 'moving',
        toolCalls: [{ id: 'c2', name: 'moveStock', arguments: { qty: 3 } }],
      },
    ]);
    const assistant = converted[0] as { tool_calls: Array<{ function: { arguments: string } }> };
    expect(JSON.parse(assistant.tool_calls[0].function.arguments)).toEqual({ qty: 3 });
  });
});
