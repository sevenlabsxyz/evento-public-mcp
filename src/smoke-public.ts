import { executePublicTool } from './public-tools.js';

async function run(): Promise<void> {
  const username = process.env.EVENTO_SMOKE_USERNAME;

  if (!username) {
    throw new Error('Set EVENTO_SMOKE_USERNAME to run smoke checks.');
  }

  const result = await executePublicTool('list-events', {
    username,
    type: 'upcoming',
    limit: 1,
  });

  if (result.isError) {
    throw new Error(`Smoke check failed: ${JSON.stringify(result.payload)}`);
  }

  console.log('Smoke check passed.');
  console.log(JSON.stringify(result.payload, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
