import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  executePublicTool,
  prepareToolRequest,
  type PublicToolDefinition,
} from '../src/public-tools.js';

describe('executePublicTool', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.PUBLIC_API_KEY = 'test-public-key';
    process.env.EVENTO_API_BASE_URL = 'https://evento.so/api';
    process.env.EVENTO_API_RETRY_ATTEMPTS = '2';
    process.env.EVENTO_API_RETRY_DELAY_MS = '0';
    process.env.EVENTO_API_TIMEOUT_MS = '5000';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('returns local error when API key is missing', async () => {
    delete process.env.PUBLIC_API_KEY;
    delete process.env.EVENTO_PUBLIC_API_KEY;

    const result = await executePublicTool('list-events', { username: 'alice' });

    expect(result.isError).toBe(true);
    expect(result.payload).toMatchObject({
      error: {
        message: expect.stringContaining('Missing API key'),
      },
    });
  });

  it('builds GET request with path interpolation and query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: 'ok', data: { events: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    global.fetch = fetchMock as typeof fetch;

    const result = await executePublicTool('list-events', {
      username: 'alice',
      type: 'upcoming',
      limit: 5,
    });

    expect(result.isError).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/public/v1/users/alice/events');
    expect(url).toContain('type=upcoming');
    expect(url).toContain('limit=5');
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-public-key',
    });
    expect(init.body).toBeUndefined();
  });

  it('returns validation error for missing required argument', async () => {
    const result = await executePublicTool('list-events', {});

    expect(result.isError).toBe(true);
    expect(result.payload).toMatchObject({
      error: {
        message: 'Missing required argument: username',
      },
    });
  });

  it('retries on retryable status and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'temporary error' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, message: 'ok', data: { id: 'evt_1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

    global.fetch = fetchMock as typeof fetch;

    const result = await executePublicTool('get-event', { eventId: 'evt_1' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.isError).toBe(false);
    expect(result.payload).toMatchObject({
      data: { id: 'evt_1' },
    });
  });
});

describe('prepareToolRequest', () => {
  it('removes path args from request body for non-GET tools', () => {
    const tool: PublicToolDefinition = {
      name: 'example-create',
      description: 'example',
      method: 'POST',
      path: '/users/{username}/events',
      inputSchema: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['username', 'title'],
      },
    };

    const prepared = prepareToolRequest(tool, {
      username: 'alice',
      title: 'Demo Event',
    });

    expect('error' in prepared).toBe(false);
    if ('error' in prepared) {
      return;
    }

    expect(prepared.url).toContain('/public/v1/users/alice/events');
    expect(prepared.init.body).toBe(JSON.stringify({ title: 'Demo Event' }));
  });
});
