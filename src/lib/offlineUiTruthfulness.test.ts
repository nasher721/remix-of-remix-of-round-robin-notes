import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const fromRoot = (...segments: string[]) => path.join(process.cwd(), ...segments);
const readSource = (file: string) => readFileSync(fromRoot(file), 'utf8');

test('mounted offline UI scopes durable queue claims to confirmed patient changes', () => {
  const source = [
    readSource('src/components/OfflineIndicator.tsx'),
    readSource('src/hooks/useNetworkStatus.ts'),
  ].join('\n');

  assert.match(source, /stored on this device/i);
  assert.match(source, /confirms Offline queued/i);
});

test('production patient mutations durably enqueue retryable update failures', () => {
  const source = readSource('src/hooks/patients/usePatientMutations.ts');

  assert.match(source, /indexedDBQueue\.enqueue/);
  assert.match(source, /Offline — change queued/);
  assert.match(source, /Patient changes could not be saved or queued/);
});

test('unreachable alternate offline mutation hooks remain removed', () => {
  assert.equal(existsSync(fromRoot('src/hooks/useOfflineMutation.ts')), false);
  assert.equal(existsSync(fromRoot('src/hooks/useOfflineSync.ts')), false);
});
