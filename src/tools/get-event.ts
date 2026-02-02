import { z } from 'zod';
import axios from 'axios';

export const getEventSchema = z.object({
  eventId: z.string().describe('The ID of the event to retrieve'),
});

export type GetEventInput = z.infer<typeof getEventSchema>;

export const getEventToolDefinition = {
  name: 'get-event',
  description: 'Get detailed information about a specific event by its ID.',
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
};

interface HostData {
  username: string;
  display_name?: string;
  avatar?: string;
  verification_status?: string;
}

interface EventData {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  timezone?: string;
  location?: string;
  visibility: string;
  status: string;
  cover?: string;
  cost?: number;
  currency?: string;
  host?: HostData;
  co_hosts?: HostData[];
  settings?: {
    max_capacity?: number;
    show_capacity_count?: boolean;
  };
  stats?: {
    attendee_count?: number;
    interested_count?: number;
  };
  created_at?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: EventData;
}

export async function getEvent(input: GetEventInput): Promise<string> {
  const apiKey = process.env.EVENTO_PUBLIC_API_KEY;

  if (!apiKey) {
    return 'Error: EVENTO_PUBLIC_API_KEY environment variable is not set';
  }

  try {
    const parsed = getEventSchema.parse(input);
    const { eventId } = parsed;

    const url = `https://api.evento.so/public/v1/events/${encodeURIComponent(eventId)}`;

    const response = await axios.get<ApiResponse>(url, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.data.success || !response.data.data) {
      return `Error: ${response.data.message || 'Failed to fetch event'}`;
    }

    const event = response.data.data;

    const startDate = new Date(event.start_date).toLocaleString();
    const endDate = new Date(event.end_date).toLocaleString();
    const timezone = event.timezone ? ` (${event.timezone})` : '';

    const hostInfo = event.host
      ? `**Host**: ${event.host.display_name || event.host.username} (@${event.host.username})${event.host.verification_status === 'verified' ? ' ✓' : ''}`
      : '';

    const coHostsInfo =
      event.co_hosts && event.co_hosts.length > 0
        ? `**Co-hosts**: ${event.co_hosts.map((c) => `${c.display_name || c.username} (@${c.username})`).join(', ')}`
        : '';

    const costInfo =
      event.cost && event.cost > 0
        ? `**Cost**: ${event.cost} ${event.currency || 'USD'}`
        : '**Cost**: Free';

    const capacityInfo =
      event.settings?.max_capacity !== undefined
        ? `**Capacity**: ${event.stats?.attendee_count || 0}/${event.settings.max_capacity}`
        : event.stats?.attendee_count
          ? `**Attendees**: ${event.stats.attendee_count}`
          : '';

    const interestedInfo =
      event.stats?.interested_count !== undefined
        ? `**Interested**: ${event.stats.interested_count}`
        : '';

    return `# ${event.title}

**Event ID**: ${event.id}
**Status**: ${event.status}
**Visibility**: ${event.visibility}

## When
- **Start**: ${startDate}${timezone}
- **End**: ${endDate}${timezone}

## Where
${event.location || 'Location not specified'}

## Details
${hostInfo}
${coHostsInfo}
${costInfo}
${capacityInfo}
${interestedInfo}

## Description
${event.description || 'No description provided.'}

${event.cover ? `**Cover Image**: ${event.cover}` : ''}
`.trim();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return `Validation error: ${error.errors.map((e) => e.message).join(', ')}`;
    }

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return `Event "${input.eventId}" not found or is not publicly accessible.`;
      }
      if (error.response?.status === 401) {
        return 'Error: Invalid API key. Please check EVENTO_PUBLIC_API_KEY.';
      }
      return `API error: ${error.response?.data?.message || error.message}`;
    }

    return `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
