import assert from 'node:assert/strict';
import test from 'node:test';
import { indexedDBQueue } from './indexedDBQueue';
import { syncEngine } from './syncEngine';

async function setQueueOwner(ownerId: string): Promise<void> {
  await indexedDBQueue.transitionOwner(ownerId, async () => undefined);
}

test('sync retains a server-newer mutation as a conflict instead of deleting it', async () => {
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  globalThis.__SUPABASE_SELECT_MOCK__ = () => ({
    data: { last_modified: '2100-01-01T00:00:00.000Z' },
    error: null,
  });

  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  const mutationId = await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'patient-1',
    payload: { diagnosis: 'local edit' },
  });

  try {
    const result = await syncEngine.sync();
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.success, 0);
    assert.equal(
      (await indexedDBQueue.getQueue()).find(item => item.id === mutationId)?.status,
      'conflict',
    );
    assert.equal(
      (await indexedDBQueue.getPendingBatch(10)).some(item => item.id === mutationId),
      false,
    );
  } finally {
    delete globalThis.__SUPABASE_SELECT_MOCK__;
    await indexedDBQueue.clear();
    if (onlineDescriptor) {
      Object.defineProperty(navigator, 'onLine', onlineDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  }
});

test('failed client-wins resolution retains the conflicted mutation', async () => {
  const updateMockGlobal = globalThis as unknown as {
    __SUPABASE_UPDATE_MOCK__?: () => { data: null; error: { message: string } };
  };
  updateMockGlobal.__SUPABASE_UPDATE_MOCK__ = () => ({
    data: null,
    error: { message: 'conflict update rejected' },
  });

  await setQueueOwner('user-a');
  await indexedDBQueue.clear();
  const mutationId = await indexedDBQueue.enqueue({
    type: 'patient',
    operation: 'update',
    table: 'patients',
    entityId: 'patient-1',
    payload: { diagnosis: 'local edit' },
  });
  await indexedDBQueue.updateStatus(mutationId, 'conflict');

  try {
    await assert.rejects(
      () => syncEngine.resolvePendingConflict({
        id: 'patient-1',
        table: 'patients',
        operation: 'update',
        clientData: { diagnosis: 'local edit' },
        serverData: { diagnosis: 'server edit' },
        originalData: { diagnosis: 'original' },
      }, 'client-wins'),
      /conflict update rejected/,
    );

    const retained = (await indexedDBQueue.getQueue()).find(item => item.id === mutationId);
    assert.equal(retained?.status, 'conflict');
  } finally {
    delete updateMockGlobal.__SUPABASE_UPDATE_MOCK__;
    await indexedDBQueue.clear();
  }
});
