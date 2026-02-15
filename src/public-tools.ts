type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface JsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

export interface PublicToolDefinition {
  name: string;
  description: string;
  method: HttpMethod;
  path: string;
  inputSchema: JsonSchema;
}

export interface ToolExecutionResult {
  isError: boolean;
  payload: unknown;
}

const PUBLIC_API_PREFIX = '/public/v1';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 250;

export const PUBLIC_TOOLS: PublicToolDefinition[] = [
  {
    name: 'list-events',
    description:
      'List events for a specific user. Returns upcoming, past, or all profile events.',
    method: 'GET',
    path: '/users/{username}/events',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'The username to list events for',
        },
        type: {
          type: 'string',
          enum: ['upcoming', 'past', 'profile'],
          description:
            'Filter events by type: upcoming, past, or profile (all public events)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of events to return',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'get-event',
    description: 'Get detailed information about a specific event by its ID.',
    method: 'GET',
    path: '/events/{eventId}',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the event to retrieve',
        },
      },
      required: ['eventId'],
    },
  },
];

function getToolByName(name: string): PublicToolDefinition | undefined {
  return PUBLIC_TOOLS.find((tool) => tool.name === name);
}

function parseEnvInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getApiBaseUrl(): string {
  return (process.env.EVENTO_API_BASE_URL ?? 'https://evento.so/api').replace(/\/$/, '');
}

function getApiKey(): string | undefined {
  return process.env.PUBLIC_API_KEY ?? process.env.EVENTO_PUBLIC_API_KEY;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRequiredArgs(
  tool: PublicToolDefinition,
  args: Record<string, unknown>
): string | undefined {
  const required = tool.inputSchema.required ?? [];
  for (const key of required) {
    if (args[key] === undefined || args[key] === null || args[key] === '') {
      return `Missing required argument: ${key}`;
    }
  }
  return undefined;
}

export function prepareToolRequest(
  tool: PublicToolDefinition,
  rawArgs: unknown
): { url: string; init: RequestInit } | { error: string } {
  const args = isObject(rawArgs) ? { ...rawArgs } : {};
  const missingRequired = validateRequiredArgs(tool, args);

  if (missingRequired) {
    return { error: missingRequired };
  }

  let resolvedPath = tool.path;
  const placeholders = tool.path.match(/\{[^}]+\}/g) ?? [];

  for (const placeholder of placeholders) {
    const key = placeholder.slice(1, -1);
    const value = args[key];

    if (value === undefined || value === null || value === '') {
      return { error: `Missing required path parameter: ${key}` };
    }

    resolvedPath = resolvedPath.replace(placeholder, encodeURIComponent(String(value)));
    delete args[key];
  }

  const baseUrl = `${getApiBaseUrl()}${PUBLIC_API_PREFIX}${resolvedPath}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const init: RequestInit = {
    method: tool.method,
    headers,
  };

  if (tool.method === 'GET' || tool.method === 'DELETE') {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }

    const query = params.toString();
    return {
      url: query ? `${baseUrl}?${query}` : baseUrl,
      init,
    };
  }

  if (Object.keys(args).length > 0) {
    init.body = JSON.stringify(args);
  }

  return {
    url: baseUrl,
    init,
  };
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybeCode = (error as Error & { code?: string }).code;
  return (
    error.name === 'AbortError' ||
    maybeCode === 'ECONNRESET' ||
    maybeCode === 'ETIMEDOUT' ||
    maybeCode === 'ENOTFOUND' ||
    maybeCode === 'EAI_AGAIN'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export async function executePublicTool(
  name: string,
  args: unknown
): Promise<ToolExecutionResult> {
  const tool = getToolByName(name);
  if (!tool) {
    return {
      isError: true,
      payload: {
        error: {
          message: `Unknown tool: ${name}`,
        },
      },
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      isError: true,
      payload: {
        error: {
          message:
            'Missing API key. Set PUBLIC_API_KEY (or EVENTO_PUBLIC_API_KEY for compatibility).',
        },
      },
    };
  }

  const prepared = prepareToolRequest(tool, args);
  if ('error' in prepared) {
    return {
      isError: true,
      payload: {
        error: {
          message: prepared.error,
        },
      },
    };
  }

  const timeoutMs = parseEnvInt(process.env.EVENTO_API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const retryAttempts = parseEnvInt(
    process.env.EVENTO_API_RETRY_ATTEMPTS,
    DEFAULT_RETRY_ATTEMPTS
  );
  const retryDelayMs = parseEnvInt(
    process.env.EVENTO_API_RETRY_DELAY_MS,
    DEFAULT_RETRY_DELAY_MS
  );

  const headers = prepared.init.headers as Record<string, string>;
  headers.Authorization = `Bearer ${apiKey}`;

  for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
    try {
      const response = await fetch(prepared.url, {
        ...prepared.init,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const body = await parseResponseBody(response);
      const bodyObject = isObject(body) ? body : undefined;

      if (!response.ok) {
        const message =
          (bodyObject?.message as string | undefined) ?? response.statusText ?? 'Request failed';

        if (attempt < retryAttempts && shouldRetryStatus(response.status)) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }

        return {
          isError: true,
          payload: {
            error: {
              status: response.status,
              message,
              details: body,
            },
          },
        };
      }

      if (bodyObject?.success === false) {
        return {
          isError: true,
          payload: {
            error: {
              status: response.status,
              message:
                (bodyObject.message as string | undefined) ??
                'API returned an unsuccessful response',
              details: body,
            },
          },
        };
      }

      return {
        isError: false,
        payload: {
          data: bodyObject?.data ?? body,
          message: (bodyObject?.message as string | undefined) ?? 'Success',
        },
      };
    } catch (error) {
      if (attempt < retryAttempts && isRetryableError(error)) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      return {
        isError: true,
        payload: {
          error: {
            message: error instanceof Error ? error.message : 'Network request failed',
          },
        },
      };
    }
  }

  return {
    isError: true,
    payload: {
      error: {
        message: 'Request failed after retries',
      },
    },
  };
}
