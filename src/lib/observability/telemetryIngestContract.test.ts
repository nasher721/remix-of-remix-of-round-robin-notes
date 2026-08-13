import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTelemetryBatch } from '../../../supabase/functions/_shared/telemetry-schema.ts';
import { createRemoteLogPayload } from './logger';

test('browser metric payloads satisfy the first-party ingest contract', () => {
  const payload = createRemoteLogPayload('info', 'metric', {
    metricName: 'patients.fetch.cache_fallback',
    metricValue: 1,
    metricUnit: 'count',
    requestId: 'req_123',
    type: 'metric',
  });
  const result = parseTelemetryBatch([payload]);

  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.rows[0].metric_name, 'patients.fetch.cache_fallback');
  assert.equal(result.rows[0].metric_value, 1);
  assert.equal('session_id' in result.rows[0], false);
});

test('browser public-funnel payloads satisfy the first-party ingest contract', () => {
  const payload = createRemoteLogPayload('info', 'marketing.contact.email', {
    feature: 'public_funnel',
    type: 'product_analytics',
  });
  const result = parseTelemetryBatch([payload]);

  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.rows[0].event_name, 'marketing.contact.email');
  assert.equal(result.rows[0].feature, 'public_funnel');
});

test('free-form browser logs are collapsed before ingest', () => {
  const payload = createRemoteLogPayload('warn', 'Patient Jane Doe failed to save', {
    patientName: 'Jane Doe',
    mrn: '12345',
  });
  const result = parseTelemetryBatch([payload]);

  assert.equal(payload.message, 'client_log');
  assert.deepEqual(payload.context, {});
  assert.equal(result.valid, true);
});

test('fixed error and retry classifications remain ingest-compatible', () => {
  const payloads = [
    createRemoteLogPayload('warn', '[Telemetry] network_error: HealthCheckError', {
      attempts: 3,
      errorType: 'HealthCheckError',
      outcome: 'unhealthy',
    }),
    createRemoteLogPayload('info', 'edge_fetch_retry', {
      attempt: 2,
      durationMs: 12.5,
      functionName: 'parse-handoff',
      maxAttempts: 3,
      status: 503,
    }),
    createRemoteLogPayload('error', 'Clinical tool failed', {
      feature: 'daily_summary',
      operation: 'round_outbox_entry',
    }),
  ];
  const result = parseTelemetryBatch(payloads);

  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.rows[0].outcome, 'unhealthy');
  assert.equal(result.rows[1].duration_ms, 13);
  assert.equal(result.rows[2].feature, 'daily_summary');
  assert.equal(result.rows[2].operation, 'round_outbox_entry');
});
