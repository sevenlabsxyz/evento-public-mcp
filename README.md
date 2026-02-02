# Evento Public MCP Server

A local Model Context Protocol (MCP) server for accessing Evento's public API through Claude Desktop. Query events and user profiles without leaving Claude.

## Features

- **list-events**: Query events for any public user profile
  - Filter by type: upcoming, past, or all profile events
  - Customize result limit
  - Get event titles, dates, locations, and descriptions

- **get-event**: Retrieve detailed event information
  - Full event details including host, co-hosts, capacity, and cost
  - Event status and visibility information
  - Attendee and interest counts

## Prerequisites

- Node.js 18+ installed
- Claude Desktop app
- Evento Public API key (free tier available)

## Installation

### 1. Clone and Build

```bash
git clone https://github.com/andreneves/evento-public-mcp.git
cd evento-public-mcp
npm install
npm run build
```

### 2. Get Your API Key

1. Visit [Evento Public API](https://api.evento.so/docs) documentation
2. Sign up for a free public API key
3. Copy your `EVENTO_PUBLIC_API_KEY`

### 3. Configure Claude Desktop

#### macOS
Open the Claude Desktop config file:
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

#### Windows
Open the Claude Desktop config file:
```
%APPDATA%\Claude\claude_desktop_config.json
```

#### Add MCP Server Configuration

Copy `claude_desktop_config.example.json` and update with your absolute path:

```json
{
  "mcpServers": {
    "evento-public": {
      "command": "node",
      "args": ["/absolute/path/to/evento-public-mcp/dist/index.js"],
      "env": {
        "EVENTO_PUBLIC_API_KEY": "your-evento-public-api-key-here"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to/evento-public-mcp` with the full path to your cloned repository.

### 4. Restart Claude Desktop

Close and reopen Claude Desktop to load the new MCP server.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EVENTO_PUBLIC_API_KEY` | Yes | Your Evento public API key for authentication |

## Available Tools

### list-events

List events for a specific user. Returns upcoming, past, or all profile events.

**Parameters:**
- `username` (string, required): The username to list events for
- `type` (string, optional): Filter by `upcoming`, `past`, or `profile` (all public events)
- `limit` (number, optional): Maximum number of events to return

**Example Usage:**

```
List upcoming events for user "alice"
```

Claude will call:
```json
{
  "username": "alice",
  "type": "upcoming",
  "limit": 10
}
```

**Response Example:**
```
# Events for @alice

Found 3 event(s) (upcoming):

## Tech Meetup 2025
- **ID**: evt_a1b2c3d4e5
- **Date**: 2/15/2025, 7:00:00 PM - 9:00:00 PM
- Location: San Francisco, CA
- **Status**: published
- **Visibility**: public
- Host: Alice Johnson

Join us for an evening of tech talks and networking...
```

### get-event

Get detailed information about a specific event by its ID.

**Parameters:**
- `eventId` (string, required): The ID of the event to retrieve

**Example Usage:**

```
Get details for event evt_a1b2c3d4e5
```

Claude will call:
```json
{
  "eventId": "evt_a1b2c3d4e5"
}
```

**Response Example:**
```
# Tech Meetup 2025

**Event ID**: evt_a1b2c3d4e5
**Status**: published
**Visibility**: public

## When
- **Start**: 2/15/2025, 7:00:00 PM (America/Los_Angeles)
- **End**: 2/15/2025, 9:00:00 PM (America/Los_Angeles)

## Where
San Francisco, CA

## Details
**Host**: Alice Johnson (@alice) ✓
**Cost**: Free
**Capacity**: 45/100
**Interested**: 12

## Description
Join us for an evening of tech talks and networking with industry professionals...

**Cover Image**: https://cdn.evento.so/events/evt_a1b2c3d4e5/cover.jpg
```

## Usage Examples

### Find Events by User

```
Show me all upcoming events for user "bob"
```

### Get Event Details

```
Tell me more about event evt_xyz123
```

### Search Multiple Users

```
List past events for users "alice" and "charlie"
```

### Discover Events

```
What events is "sarah" hosting? Show me the details of her next event.
```

## How It Works

This MCP server runs **locally** on your machine and communicates with Claude Desktop via stdio transport. It:

1. Receives tool requests from Claude Desktop
2. Validates input parameters using Zod schemas
3. Makes authenticated requests to Evento's public API
4. Formats responses as readable markdown
5. Returns results to Claude

**No data is sent to external servers** - all communication is local to your machine.

## Troubleshooting

### "EVENTO_PUBLIC_API_KEY not set" Error

**Solution**: Ensure the environment variable is set in your Claude Desktop config:
```json
"env": {
  "EVENTO_PUBLIC_API_KEY": "your-actual-api-key"
}
```

### "Invalid API key" Error

**Solution**: Verify your API key is correct:
1. Check the Evento API dashboard
2. Regenerate the key if needed
3. Update your Claude Desktop config
4. Restart Claude Desktop

### "User not found" Error

**Solution**: The username doesn't exist or has no public events:
- Verify the username spelling
- Check if the user's profile is public
- Try a different username

### "Event not found" Error

**Solution**: The event ID is invalid or the event is not publicly accessible:
- Verify the event ID format (should start with `evt_`)
- Check if the event is published and public
- Try listing events for the host user first

### MCP Server Not Appearing in Claude

**Solution**: 
1. Verify the path in your config is absolute (not relative)
2. Ensure `npm run build` completed successfully
3. Check that `dist/index.js` exists
4. Restart Claude Desktop completely
5. Check Claude's logs for errors

## Development

To modify or add new tools:

1. Create new tool in `src/tools/`
2. Import and register in `src/mcp-server.ts`
3. Run `npm run build`
4. Restart Claude Desktop

### Project Structure

```
evento-public-mcp/
├── src/
│   ├── index.ts              # Entry point
│   ├── mcp-server.ts         # MCP server setup
│   └── tools/
│       ├── list-events.ts    # List events tool
│       └── get-event.ts      # Get event details tool
├── dist/                     # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Open Source & Local-Only

This MCP server is designed for **local use only**:

- ✅ Runs entirely on your machine
- ✅ Uses stdio transport (no HTTP server)
- ✅ No cloud hosting or external dependencies
- ✅ Your API key stays on your machine
- ✅ Open source and auditable

## License

ISC

## Support

For issues or questions:
- Check the [Evento API Documentation](https://api.evento.so/docs)
- Review the troubleshooting section above
- Open an issue on GitHub
