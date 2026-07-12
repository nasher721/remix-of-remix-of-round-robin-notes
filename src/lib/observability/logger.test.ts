import assert from 'node:assert/strict';
import test from 'node:test';

import { createRemoteLogPayload } from './logger';

test('remote log payload excludes raw errors and non-allowlisted clinical context', () => {
  const payload = createRemoteLogPayload(
    'error',
    '[Telemetry] ai_error: Patient Jane Doe had a seizure',
    {
      feature: 'daily-summary',
      patientName: 'Jane Doe',
      responseBody: 'clinical narrative',
      statusCode: 500,
      errorType: 'ProviderError',
      unsafeErrorType: 'Patient Jane Doe',
    },
  );

  assert.equal(payload.message, 'telemetry.ai_error');
  assert.deepEqual(payload.context, {
    feature: 'daily-summary',
    statusCode: 500,
    errorType: 'ProviderError',
  });
  assert.equal(JSON.stringify(payload).includes('Jane Doe'), false);
  assert.equal(JSON.stringify(payload).includes('clinical narrative'), false);
});
