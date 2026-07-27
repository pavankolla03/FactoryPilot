import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { LiveDataService } from '../live/live-data.service';

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

  constructor(private readonly live: LiveDataService) {
    const raw = process.env.MCP_SERVERS || '{}';
    this.servers = JSON.parse(raw) as Record<string, string>;
  }

  async onModuleInit() {
    for (const [name, baseUrl] of Object.entries(this.servers)) {
      try {
        await this.withClient(name, async (client) => {
          const listed = await client.listTools();
          for (const tool of listed.tools) {
            this.tools.set(tool.name, {
              name: tool.name,
              description: tool.description || '',
              inputSchema: (tool.inputSchema as Record<string, unknown>) || {},
              serverName: name,
            });
          }
          this.logger.log(`Registered ${listed.tools.length} tools from ${name} (${baseUrl})`);
        });
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

  async callTool(name: string, args: Record<string, unknown>, orgId?: string | null, full = false) {
    // Live SAP wins over the simulator (Phase AF). Intercepting here means every
    // consumer — chat, board, Insights cards and the agents — reads real data
    // wherever a connected source can answer, with no per-service wiring.
    if (this.live.canServe(name)) {
      const served = await this.live.serve(name, args, orgId, full).catch((error) => {
        this.logger.warn(`live serve(${name}) failed: ${error instanceof Error ? error.message : 'unknown'}`);
        return null;
      });
      if (served) {
        return served as unknown as Record<string, unknown>;
      }
    }

    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return this.withClient(tool.serverName, async (client) => {
      const result = await client.callTool({ name, arguments: args });
      if (result.isError) {
        const text = Array.isArray(result.content)
          ? result.content
              .filter((c): c is { type: 'text'; text: string } => (c as { type: string }).type === 'text')
              .map((c) => c.text)
              .join('\n')
          : '';
        throw new Error(text || `Tool ${name} failed`);
      }
      return result as Record<string, unknown>;
    });
  }

  private async withClient<T>(serverName: string, fn: (client: Client) => Promise<T>): Promise<T> {
    const baseUrl = this.servers[serverName];
    if (!baseUrl) {
      throw new Error(`Unknown MCP server: ${serverName}`);
    }

    const client = new Client({ name: 'orchestrator', version: '1.0.0' });
    const secret = process.env.MCP_SHARED_SECRET;
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl.replace(/\/$/, '')}/mcp`), {
      requestInit: secret ? { headers: { 'x-mcp-secret': secret } } : undefined,
    });
    await client.connect(transport);
    try {
      return await fn(client);
    } finally {
      await client.close().catch(() => undefined);
    }
  }
}
