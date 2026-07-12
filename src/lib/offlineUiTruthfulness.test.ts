import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const fromRoot = (...segments: string[]) => path.join(process.cwd(), ...segments);
const readSource = (file: string) => readFileSync(fromRoot(file), 'utf8');

test('mounted offline UI does not promise that new writes are queued', () => {
  const source = [
    readSource('src/components/OfflineIndicator.tsx'),
    readSource('src/hooks/useNetworkStatus.ts'),
  ].join('\n');

  assert.doesNotMatch(source, /Changes will sync when you're back online/i);
  assert.doesNotMatch(source, /Changes will be saved locally and synced/i);
  assert.doesNotMatch(source, /Syncing changes/i);
  assert.match(source, /New changes are not queued/i);
});

test('production patient mutations do not pretend to enqueue offline writes', () => {
  const source = readSource('src/hooks/patients/usePatientMutations.ts');

  assert.doesNotMatch(source, /useOfflineMode|queueMutation|indexedDBQueue/);
  assert.match(source, /Patient changes could not be saved\. Please try again\./);
});

test('unreachable alternate offline mutation hooks remain removed', () => {
  assert.equal(existsSync(fromRoot('src/hooks/useOfflineMutation.ts')), false);
  assert.equal(existsSync(fromRoot('src/hooks/useOfflineSync.ts')), false);
});
