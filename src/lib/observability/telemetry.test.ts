import assert from 'node:assert/strict';
import test from 'node:test';

import { recordTelemetryEvent } from './telemetry';

test('telemetry persists classified errors without raw clinical content', () => {
  const event = recordTelemetryEvent(
    'ai_error',
    new Error('Patient Jane Doe had a seizure'),
    {
      feature: 'daily-summary',
      patientName: 'Jane Doe',
      responseBody: 'clinical narrative',
      statusCode: 500,
    },
  );

  assert.equal(event.message, 'ai_error:Error');
  assert.equal(event.stack, undefined);
  assert.deepEqual(event.context, {
    feature: 'daily-summary',
    statusCode: 500,
    errorType: 'Error',
  });
  assert.equal(JSON.stringify(event).includes('Jane Doe'), false);
  assert.equal(JSON.stringify(event).includes('clinical narrative'), false);
});
