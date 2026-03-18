import { runIntegrationPreflight } from './preflight';

beforeAll(async () => {
  await runIntegrationPreflight();
}, 60_000);
