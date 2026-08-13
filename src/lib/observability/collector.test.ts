import assert from 'node:assert/strict';
import test from 'node:test';

import { createCollectorRuntime } from './collector';

function fakeTimers() {
  let scheduled = 0;
  return {
    get scheduled() {
      return scheduled;
    },
    setTimer: () => {
      scheduled += 1;
      return scheduled;
    },
    clearTimer: () => {},
  };
}

test('collector remains a no-op when no approved ingest URL is configured', async () => {
  let fetchCalls = 0;
  const timers = fakeTimers();
  const collector = createCollectorRuntime({
    getIngestUrl: () => undefined,
    fetchImpl: async () => {
      fetchCalls += 1;
      return { ok: true };
    },
    ...timers,
  });

  collector.push({ message: 'metric' });
  await collector.flush();

  assert.equal(collector.getBufferSize(), 0);
  assert.equal(fetchCalls, 0);
  assert.equal(timers.scheduled, 0);
});

test('collector retains telemetry without transport while offline and flushes on reconnect', async () => {
  const timers = fakeTimers();
  let offline = true;
  let fetchCalls = 0;
  const collector = createCollectorRuntime({
    getIngestUrl: () => 'https://telemetry.example.test/ingest',
    fetchImpl: async () => {
      fetchCalls += 1;
      return { ok: true };
    },
    isOffline: () => offline,
    ...timers,
  });

  collector.push({ event: 'offline-error' });
  await collector.flush();
  assert.equal(fetchCalls, 0);
  assert.equal(collector.getBufferSize(), 1);
  assert.equal(timers.scheduled, 0);

  offline = false;
  await collector.flush();
  assert.equal(fetchCalls, 1);
  assert.equal(collector.getBufferSize(), 0);
});

test('collector requeues a non-2xx batch and schedules a bounded retry', async () => {
  const timers = fakeTimers();
  const collector = createCollectorRuntime({
    getIngestUrl: () => 'https://telemetry.example.test/ingest',
    fetchImpl: async () => ({ ok: false }),
    ...timers,
  });

  collector.push({ event: 'first' });
  await collector.flush();

  assert.equal(collector.getBufferSize(), 1);
  assert.ok(timers.scheduled >= 2, 'initial flush and retry should both be scheduled');
});

test('collector retains a failed in-flight batch when newer events arrive', async () => {
  const timers = fakeTimers();
  let rejectFetch!: (reason: Error) => void;
  const collector = createCollectorRuntime({
    getIngestUrl: () => 'https://telemetry.example.test/ingest',
    fetchImpl: () => new Promise((_resolve, reject) => {
      rejectFetch = reject;
    }),
    ...timers,
  });

  collector.push({ event: 'first' });
  const flushing = collector.flush();
  collector.push({ event: 'second' });
  rejectFetch(new Error('network unavailable'));
  await flushing;

  assert.equal(collector.getBufferSize(), 2);
});

test('concurrent flush callers serialize and drain events queued during delivery', async () => {
  const timers = fakeTimers();
  const resolvers: Array<(response: { ok: boolean }) => void> = [];
  let fetchCalls = 0;
  const collector = createCollectorRuntime({
    getIngestUrl: () => 'https://telemetry.example.test/ingest',
    fetchImpl: () => {
      fetchCalls += 1;
      return new Promise((resolve) => resolvers.push(resolve));
    },
    ...timers,
  });

  collector.push({ event: 'first' });
  const firstFlush = collector.flush();
  collector.push({ event: 'second' });
  const secondFlush = collector.flush();

  resolvers.shift()?.({ ok: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  resolvers.shift()?.({ ok: true });
  await Promise.all([firstFlush, secondFlush]);

  assert.equal(fetchCalls, 2);
  assert.equal(collector.getBufferSize(), 0);
});

test('collector caps retained memory and keeps the most recent sanitized events', async () => {
  const timers = fakeTimers();
  let delivered: Array<{ event: string }> = [];
  const collector = createCollectorRuntime({
    getIngestUrl: () => 'https://telemetry.example.test/ingest',
    fetchImpl: async (_url, init) => {
      delivered = JSON.parse(String(init.body)) as Array<{ event: string }>;
      return { ok: true };
    },
    maxBatchSize: 10,
    maxRetainedEvents: 2,
    ...timers,
  });

  collector.push({ event: 'first' });
  collector.push({ event: 'second' });
  collector.push({ event: 'third' });
  assert.equal(collector.getBufferSize(), 2);

  await collector.flush();
  assert.deepEqual(delivered.map((event) => event.event), ['second', 'third']);
  assert.equal(collector.getBufferSize(), 0);
});
