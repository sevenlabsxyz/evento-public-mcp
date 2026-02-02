import { z } from 'zod';
import axios from 'axios';

export const listEventsSchema = z.object({
  username: z.string().describe('The username to list events for'),
  type: z
    .enum(['upcoming', 'past', 'profile'])
    .optional()
    .describe('Filter events by type: upcoming, past, or profile (all public events)'),
  limit: z.number().optional().describe('Maximum number of events to return'),
});

export type ListEventsInput = z.infer<typeof listEventsSchema>;

export const listEventsToolDefinition = {
  name: 'list-events',
  description:
    'List events for a specific user. Returns upcoming, past, or all profile events.',
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
};

interface EventData {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  location?: string;
  visibility: string;
  status: string;
  cover?: string;
  host?: {
    username: string;
    display_name?: string;
  };
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: {
    events: EventData[];
    total: number;
  };
}

export async function listEvents(input: ListEventsInput): Promise<string> {
  const apiKey = process.env.EVENTO_PUBLIC_API_KEY;

  if (!apiKey) {
    return 'Error: EVENTO_PUBLIC_API_KEY environment variable is not set';
  }

  try {
    const parsed = listEventsSchema.parse(input);
    const { username, type, limit } = parsed;

    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (limit) params.append('limit', limit.toString());

    const url = `https://api.evento.so/public/v1/users/${encodeURIComponent(username)}/events${params.toString() ? '?' + params.toString() : ''}`;

    const response = await axios.get<ApiResponse>(url, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.data.success || !response.data.data) {
      return `Error: ${response.data.message || 'Failed to fetch events'}`;
    }

    const { events, total } = response.data.data;

    if (events.length === 0) {
      return `No ${type || ''} events found for user "${username}".`;
    }

    const formatted = events
      .map((event) => {
        const startDate = new Date(event.start_date).toLocaleString();
        const endDate = new Date(event.end_date).toLocaleString();
        const location = event.location ? `Location: ${event.location}` : 'Location: Not specified';
        const host = event.host
          ? `Host: ${event.host.display_name || event.host.username}`
          : '';

        return `
## ${event.title}
- **ID**: ${event.id}
- **Date**: ${startDate} - ${endDate}
- ${location}
- **Status**: ${event.status}
- **Visibility**: ${event.visibility}
${host ? `- ${host}` : ''}
${event.description ? `\n${event.description.substring(0, 200)}${event.description.length > 200 ? '...' : ''}` : ''}
`.trim();
      })
      .join('\n\n---\n\n');

    return `# Events for @${username}

Found ${total} event(s)${type ? ` (${type})` : ''}:

${formatted}`;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return `Validation error: ${error.errors.map((e) => e.message).join(', ')}`;
    }

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return `User "${input.username}" not found or has no public events.`;
      }
      if (error.response?.status === 401) {
        return 'Error: Invalid API key. Please check EVENTO_PUBLIC_API_KEY.';
      }
      return `API error: ${error.response?.data?.message || error.message}`;
    }

    return `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
