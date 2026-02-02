import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  listEvents,
  listEventsToolDefinition,
  ListEventsInput,
} from './tools/list-events.js';
import {
  getEvent,
  getEventToolDefinition,
  GetEventInput,
} from './tools/get-event.js';

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
    tools: [listEventsToolDefinition, getEventToolDefinition],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'list-events') {
    const result = await listEvents(args as ListEventsInput);
    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  }

  if (name === 'get-event') {
    const result = await getEvent(args as GetEventInput);
    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

export async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Evento Public MCP Server started');
}
