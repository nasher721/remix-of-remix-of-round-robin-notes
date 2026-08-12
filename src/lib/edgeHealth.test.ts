import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { invalidateEdgeHealthCache, probeEdgeHealth } from './edgeHealth';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  invalidateEdgeHealthCache();
});

test('edge health uses the endpoint GET contract without retrying a healthy response', async () => {
  const calls: Array<{ input: string; method: string | undefined }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), method: init?.method });
    return new Response(JSON.stringify({ status: 'healthy' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  invalidateEdgeHealthCache();
  assert.equal(await probeEdgeHealth({ force: true }), 'healthy');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, 'GET');
  assert.match(calls[0]?.input ?? '', /\/functions\/v1\/healthcheck$/);
});
