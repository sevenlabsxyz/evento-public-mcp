# Evento Public MCP Server

Local MCP server for Evento developer-facing authenticated public APIs.

It runs on your machine over stdio, authenticates every API call with your API key, and can be connected to Claude Desktop (or any MCP client that supports stdio transport).

## What This Server Is

- MCP transport adapter only (stdio)
- Tool calls mapped to Evento Public API routes
- Auth injected centrally using your API key
- No database access, no Supabase, no server-side persistence in MCP layer

This follows the same architecture shape as the admin MCP pattern, with different API routes and key type.

## Features

- `list-events`
  - Lists user events
  - Optional filters: `type`, `limit`
- `get-event`
  - Gets one event by ID

## Requirements

- Node.js 18+
- npm
- Evento developer-facing API key
- MCP client (Claude Desktop, Cursor, etc.)

## Quick Start

```bash
git clone https://github.com/andreneves/evento-public-mcp.git
cd evento-public-mcp
npm install
npm run build
```

Create your env file:

```bash
cp .env.example .env
```

Set at least:

- `PUBLIC_API_KEY`

Then run:

```bash
npm start
```

## Environment Variables

Required:

- `PUBLIC_API_KEY`
  - Developer-facing Evento API key used as `Authorization: Bearer <key>`

Optional:

- `EVENTO_API_BASE_URL` (default: `https://api.evento.so`)
- `EVENTO_API_TIMEOUT_MS` (default: `15000`)
- `EVENTO_API_RETRY_ATTEMPTS` (default: `2`)
- `EVENTO_API_RETRY_DELAY_MS` (default: `250`)
- `EVENTO_PUBLIC_API_KEY` (legacy compatibility fallback if `PUBLIC_API_KEY` is missing)
- `EVENTO_SMOKE_USERNAME` (used by smoke command)

## MCP Client Configuration

Example Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "evento-public": {
      "command": "node",
      "args": ["/absolute/path/to/evento-public-mcp/dist/index.js"],
      "env": {
        "PUBLIC_API_KEY": "your-evento-api-key",
        "EVENTO_API_BASE_URL": "https://api.evento.so"
      }
    }
  }
}
```

Notes:

- Use an absolute path in `args`
- Restart Claude Desktop after config changes

## Available Tools

### `list-events`

List events for a user.

Input:

- `username` (required, string)
- `type` (optional, `upcoming | past | profile`)
- `limit` (optional, number)

Route mapping:

- `GET /public/v1/users/{username}/events`

### `get-event`

Get event details by ID.

Input:

- `eventId` (required, string)

Route mapping:

- `GET /public/v1/events/{eventId}`

## Architecture

Key files:

- `src/index.ts`
  - process entrypoint
- `src/mcp-server.ts`
  - MCP protocol handling (`tools/list`, `tools/call`)
- `src/public-tools.ts`
  - single runtime registry (`PUBLIC_TOOLS`)
  - generic executor (`executePublicTool`)
  - auth/header injection, path interpolation, timeout/retry, normalized response
- `PUBLIC_MCP.tools.json`
  - manifest mirror of runtime tools

Execution flow:

1. MCP client calls `tools/list`
2. server returns `PUBLIC_TOOLS`
3. MCP client calls `tools/call`
4. server delegates to `executePublicTool(name, args)`
5. executor validates required args, resolves path placeholders, strips path args from body
6. executor calls Evento API with auth header and retry/timeout policy
7. executor normalizes success/error payload back to MCP response

## Local Development

Install deps:

```bash
npm install
```

Run directly in TypeScript:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Run built server:

```bash
npm start
```

## Testing and Verification

Run tests:

```bash
npm test
```

Run build + tests:

```bash
npm run verify
```

Smoke check (live API):

```bash
EVENTO_SMOKE_USERNAME=your-username npm run smoke
```

Test layers included:

- Unit: `tests/public-tools.unit.test.ts`
- Manifest parity: `tests/manifest-parity.test.ts`
- MCP stdio e2e: `tests/mcp.e2e.test.ts`

## Adding a New Tool

1. Add a new tool definition to `PUBLIC_TOOLS` in `src/public-tools.ts`
   - name, description, method, path, input schema
2. Ensure route/path placeholders align with args
3. Update `PUBLIC_MCP.tools.json` to match
4. Add/extend unit tests and parity assertions
5. Run `npm run verify`

## Error Handling and Retry Policy

- Retries on retryable statuses: `408`, `429`, `5xx`
- Retries on retryable network errors (timeout / DNS / connection reset classes)
- Controlled by env vars (`EVENTO_API_RETRY_*`)
- Returns MCP `isError: true` with structured error payload when failed

## Troubleshooting

### Missing API key

Symptom:

- Tool call returns missing key error

Fix:

- Set `PUBLIC_API_KEY` in MCP client env config

### Tools not visible in client

Fix checklist:

1. Run `npm run build`
2. Confirm `dist/index.js` exists
3. Confirm absolute path in MCP config
4. Restart MCP client app

### API errors

Fix checklist:

1. Verify key is valid for authenticated public endpoints
2. Verify `EVENTO_API_BASE_URL`
3. Run smoke check with a known username

## Security Notes

- Keep API keys in local env config, not source control
- This project does not store your API key beyond process env

## License

ISC
