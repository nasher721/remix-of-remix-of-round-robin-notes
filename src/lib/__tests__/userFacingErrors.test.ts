import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiError } from '@/api/apiClient';
import { CircuitOpenError } from '@/lib/circuitBreaker';
import { TimeoutError } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';

test('maps TimeoutError', () => {
  assert.match(
    getUserFacingErrorMessage(new TimeoutError('op', 1000)),
    /longer than expected/i,
  );
});

test('maps CircuitOpenError', () => {
  const msg = getUserFacingErrorMessage(new CircuitOpenError('edge:fn', 5000));
  assert.match(msg, /busy/i);
  assert.match(msg, /5/);
});

test('maps ApiError wrapping CircuitOpenError cause', () => {
  const wrapped: ApiError = {
    name: 'ApiError',
    message: 'wrapped',
    cause: new CircuitOpenError('edge:x', 3000),
  };
  const msg = getUserFacingErrorMessage(wrapped);
  assert.match(msg, /Try again/);
});

test('maps 429 from ApiError status', () => {
  const e: ApiError = { name: 'ApiError', message: 'rate limited', status: 429 };
  assert.match(getUserFacingErrorMessage(e), /Too many requests/i);
});

test('uses fallback for unknown', () => {
  assert.equal(getUserFacingErrorMessage(null, 'Fallback'), 'Fallback');
});
