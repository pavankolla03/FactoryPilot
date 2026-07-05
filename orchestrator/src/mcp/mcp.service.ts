import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
}

@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);
  private readonly servers: Record<string, string>;
  private readonly tools = new Map<string, ToolDescriptor>();

  constructor() {
    const raw = process.env.MCP_SERVERS || '{}';
    this.servers = JSON.parse(raw) as Record<string, string>;
  }

  async onModuleInit() {
    for (const [name, baseUrl] of Object.entries(this.servers)) {
      try {
        await fetch(`${baseUrl}/health`);
        const listedResponse = await fetch(`${baseUrl}/tools/list`);
        if (!listedResponse.ok) {
          throw new Error(`tools/list failed with ${listedResponse.status}`);
        }

        const listed = (await listedResponse.json()) as {
          tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>;
        };

        const toolList = listed.tools || [];

        for (const tool of toolList) {
          this.tools.set(tool.name, {
            name: tool.name,
            description: tool.description || '',
            inputSchema: tool.inputSchema || {},
            serverName: name,
          });
        }
        this.logger.log(`Registered ${toolList.length} tools from ${name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        this.logger.error(`Failed to register tools from ${name}: ${message}`);
      }
    }
  }

  listTools(): ToolDescriptor[] {
    return [...this.tools.values()];
  }

  getTool(name: string) {
    return this.tools.get(name);
  }

  async callTool(name: string, args: Record<string, unknown>) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const baseUrl = this.servers[tool.serverName];
    const response = await fetch(`${baseUrl}/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
      name,
      arguments: args,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(body.error?.message || `tools/call failed with ${response.status}`);
    }

    const result = (await response.json()) as Record<string, unknown>;

    return result;
  }
}
