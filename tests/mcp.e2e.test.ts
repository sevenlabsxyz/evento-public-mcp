import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';

describe('mcp stdio e2e', () => {
  const client = new Client(
    {
      name: 'evento-public-mcp-tests',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      PUBLIC_API_KEY: process.env.PUBLIC_API_KEY ?? 'test-public-key',
      EVENTO_API_BASE_URL: process.env.EVENTO_API_BASE_URL ?? 'https://api.evento.so',
      EVENTO_API_TIMEOUT_MS: '1000',
      EVENTO_API_RETRY_ATTEMPTS: '0',
      EVENTO_API_RETRY_DELAY_MS: '0',
    },
  });

  beforeAll(async () => {
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('lists runtime tools from registry', async () => {
    const result = await client.request(
      {
        method: 'tools/list',
        params: {},
      },
      ListToolsResultSchema
    );

    const names = result.tools.map((tool) => tool.name);
    expect(names).toContain('list-events');
    expect(names).toContain('get-event');
  });

  it('returns a validation error for invalid tools/call input', async () => {
    const result = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'list-events',
          arguments: {},
        },
      },
      CallToolResultSchema
    );

    expect(result.isError).toBe(true);
  });
});
