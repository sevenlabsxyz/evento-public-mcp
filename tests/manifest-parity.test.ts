import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_TOOLS } from '../src/public-tools.js';

describe('manifest parity', () => {
  it('keeps PUBLIC_MCP.tools.json aligned with PUBLIC_TOOLS runtime registry', () => {
    const manifestPath = resolve(process.cwd(), 'PUBLIC_MCP.tools.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      tools: unknown[];
    };

    const runtimeTools = PUBLIC_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      method: tool.method,
      path: tool.path,
      inputSchema: tool.inputSchema,
    }));

    expect(manifest.tools).toEqual(runtimeTools);
  });
});
