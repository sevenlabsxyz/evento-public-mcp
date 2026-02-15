import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { executePublicTool, PUBLIC_TOOLS } from './public-tools.js';

const server = new Server(
  {
    name: 'evento-public-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: PUBLIC_TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = await executePublicTool(name, args ?? {});

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result.payload, null, 2),
      },
    ],
    isError: result.isError,
  };
});

export async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Evento Public MCP Server started');
}
