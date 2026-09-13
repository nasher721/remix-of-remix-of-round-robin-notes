import assert from 'node:assert/strict';
import test from 'node:test';
import { PrintPreferenceSession, type PrintPreferenceRepository } from './preferenceSession';
import { createDefaultPrintPreferences, readAnonymousPrintPreferences, writePrintPreferenceCache } from './preferencePayload';
import { createScopedPrintStorage } from './preferences';
import type { StorageLike } from '@/utils/safeStorage';

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const namedPayload = (font: string) => {
  const payload = createDefaultPrintPreferences();
  payload.settings.printFontFamily = font;
  return payload;
};

test('late account A load cannot populate account B or initialize an abandoned account', async () => {
  const pendingA = deferred<unknown>();
  const writes: string[] = [];
  const storage = memoryStorage();
  const repository: PrintPreferenceRepository = {
    load: owner => owner === 'a' ? pendingA.promise : Promise.resolve(namedPayload('B font')),
    save: async owner => { writes.push(owner); },
  };
  const a = new PrintPreferenceSession('a', { storage, repository });
  const oldLoad = a.load();
  a.stop();
  const b = new PrintPreferenceSession('b', { storage, repository });
  await b.load();
  pendingA.resolve(null);
  await oldLoad;
  assert.equal(b.getSnapshot().payload.settings.printFontFamily, 'B font');
  assert.equal(a.getSnapshot().status, 'idle');
  assert.deepEqual(writes, []);
  b.stop();
});

test('authenticated loading ignores even owner-scoped browser cache and initializes only defaults', async () => {
  const storage = memoryStorage();
  writePrintPreferenceCache(createScopedPrintStorage('a', storage), namedPayload('cached private font'));
  const writes: unknown[] = [];
  const session = new PrintPreferenceSession('a', { storage, repository: {
    load: async () => null,
    save: async (owner, payload) => { writes.push({ owner, payload }); },
  } });
  await session.load();
  assert.deepEqual(writes, [{ owner: 'a', payload: createDefaultPrintPreferences() }]);
  assert.equal(session.getSnapshot().payload.settings.printFontFamily, 'system');
  assert.equal(session.getSnapshot().status, 'ready');
  session.stop();
});

test('failed loading never promotes defaults or user edits; reopening retries the database', async () => {
  let fail = true;
  const writes: string[] = [];
  const errors: string[] = [];
  const session = new PrintPreferenceSession('a', { storage: memoryStorage(), onError: op => errors.push(op), repository: {
    load: async () => { if (fail) throw new Error('offline'); return namedPayload('database font'); },
    save: async owner => { writes.push(owner); },
  } });
  await session.load();
  session.update('selectedTemplateId', 'compact');
  await session.flush();
  assert.equal(session.getSnapshot().status, 'error');
  assert.deepEqual(errors, ['load']);
  assert.deepEqual(writes, []);
  fail = false;
  await session.load();
  assert.equal(session.getSnapshot().payload.settings.printFontFamily, 'database font');
  assert.equal(session.getSnapshot().payload.selectedTemplateId, 'standard');
  session.stop();
});

test('initialization waits before saving edits and initialization failures never mark settings ready', async () => {
  const initialWrite = deferred<void>();
  const writes: string[] = [];
  const session = new PrintPreferenceSession('a', { storage: memoryStorage(), repository: {
    load: async () => null,
    save: async (_owner, payload) => { writes.push(payload.selectedTemplateId); await initialWrite.promise; },
  } });
  const loading = session.load();
  await Promise.resolve();
  assert.equal(session.getSnapshot().status, 'loading');
  session.update('selectedTemplateId', 'compact');
  await session.flush();
  assert.deepEqual(writes, ['standard']);
  initialWrite.resolve();
  await loading;
  await session.flush();
  assert.deepEqual(writes, ['standard', 'compact']);
  assert.equal(session.getSnapshot().status, 'ready');
  session.stop();

  const failed = new PrintPreferenceSession('b', { storage: memoryStorage(), repository: {
    load: async () => null,
    save: async () => { throw new Error('initialization failed'); },
  } });
  await failed.load();
  assert.equal(failed.getSnapshot().status, 'error');
  failed.stop();
});

test('owner change cancels a pending debounced write and leaves B unaffected', async () => {
  const writes: string[] = [];
  const repository: PrintPreferenceRepository = {
    load: async () => createDefaultPrintPreferences(),
    save: async owner => { writes.push(owner); },
  };
  const storage = memoryStorage();
  const a = new PrintPreferenceSession('a', { storage, repository, debounceMs: 0 });
  await a.load();
  a.update('selectedTemplateId', 'compact');
  a.stop();
  const b = new PrintPreferenceSession('b', { storage, repository });
  await b.load();
  await a.flush();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(writes, []);
  assert.equal(b.getSnapshot().payload.selectedTemplateId, 'standard');
  b.stop();
});

test('writes serialize and coalesce while older saves are delayed', async () => {
  const delayedSave = deferred<void>();
  const writes: string[] = [];
  const session = new PrintPreferenceSession('a', { storage: memoryStorage(), repository: {
    load: async () => createDefaultPrintPreferences(),
    save: async (_owner, payload) => {
      writes.push(payload.settings.printFontFamily);
      if (writes.length === 1) await delayedSave.promise;
    },
  } });
  await session.load();
  session.update('settings', previous => ({ ...previous, printFontFamily: 'first' }));
  const saving = session.flush();
  session.update('settings', previous => ({ ...previous, printFontFamily: 'intermediate' }));
  session.update('settings', previous => ({ ...previous, printFontFamily: 'latest' }));
  await session.flush();
  assert.deepEqual(writes, ['first']);
  delayedSave.resolve();
  await saving;
  assert.deepEqual(writes, ['first', 'latest']);
  session.stop();
});

test('an in-flight save retains its captured owner and cannot start more writes after stop', async () => {
  const delayedSave = deferred<void>();
  const writes: string[] = [];
  const session = new PrintPreferenceSession('a', { storage: memoryStorage(), repository: {
    load: async () => createDefaultPrintPreferences(),
    save: async owner => { writes.push(owner); await delayedSave.promise; },
  } });
  await session.load();
  session.update('selectedTemplateId', 'compact');
  const saving = session.flush();
  session.update('selectedTemplateId', 'standard');
  session.stop();
  delayedSave.resolve();
  await saving;
  assert.deepEqual(writes, ['a']);
});

test('cancelled load can restart and ignores replies from its earlier generation', async () => {
  const first = deferred<unknown>();
  let count = 0;
  const session = new PrintPreferenceSession('a', { storage: memoryStorage(), repository: {
    load: async () => ++count === 1 ? first.promise : namedPayload('current'),
    save: async () => {},
  } });
  const old = session.load();
  session.stop();
  session.start();
  await session.load();
  first.resolve(namedPayload('obsolete'));
  await old;
  assert.equal(session.getSnapshot().payload.settings.printFontFamily, 'current');
  session.stop();
});

test('an edit before hydration replays over the database without replacing unrelated preferences', async () => {
  const pending = deferred<unknown>();
  const writes: ReturnType<typeof createDefaultPrintPreferences>[] = [];
  const session = new PrintPreferenceSession('a', { storage: memoryStorage(), repository: {
    load: async () => pending.promise,
    save: async (_owner, payload) => { writes.push(payload); },
  } });
  const loading = session.load();
  session.update('settings', previous => ({ ...previous, printFontSize: 15 }));
  session.update('selectedTemplateId', 'compact');
  const database = namedPayload('saved font');
  database.settings.paperSize = 'letter';
  pending.resolve(database);
  await loading;
  await session.flush();
  assert.equal(session.getSnapshot().payload.settings.printFontSize, 15);
  assert.equal(session.getSnapshot().payload.settings.printFontFamily, 'saved font');
  assert.equal(session.getSnapshot().payload.settings.paperSize, 'letter');
  assert.equal(session.getSnapshot().payload.selectedTemplateId, 'compact');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].settings.printFontFamily, 'saved font');
  session.stop();
});

test('successfully hydrated preferences retain choices on reopen without a new database request', async () => {
  let reads = 0;
  const session = new PrintPreferenceSession('a', { storage: memoryStorage(), repository: {
    load: async () => { reads++; return createDefaultPrintPreferences(); },
    save: async () => {},
  } });
  await session.load();
  session.update('selectedTemplateId', 'compact');
  session.cancelLoad();
  await session.load();
  assert.equal(reads, 1);
  assert.equal(session.getSnapshot().payload.selectedTemplateId, 'compact');
  session.stop();
});

test('each session receives independent mutable default collections', () => {
  const first = createDefaultPrintPreferences();
  const second = createDefaultPrintPreferences();
  first.settings.columns[0].label = 'Changed';
  first.settings.columnWidths.patient = 999;
  first.settings.rounds!.sections[0].enabled = false;
  assert.notEqual(second.settings.columns[0].label, 'Changed');
  assert.notEqual(second.settings.columnWidths.patient, 999);
  assert.equal(second.settings.rounds!.sections[0].enabled, true);
});

test('anonymous settings load without a database and round trip paper, rounds, combinations and presets', async () => {
  const storage = memoryStorage();
  const scoped = createScopedPrintStorage(null, storage);
  const payload = createDefaultPrintPreferences();
  payload.settings.paperSize = 'letter';
  payload.settings.sectionSpacing = 22;
  payload.settings.showNotesColumn = true;
  payload.settings.rounds = { ...payload.settings.rounds!, pageSize: 'letter', variant: 'twoColumn' };
  payload.customCombinations = [{ key: 'custom', label: 'My combined notes', columns: ['summary', 'events'], isCustom: true, createdAt: '2026-09-13' }];
  payload.templatePresets = [{ id: 'preset', name: 'Custom name', templateType: 'standard', customizations: {}, isDefault: false, createdAt: '2026-09-13', updatedAt: '2026-09-13' }];
  writePrintPreferenceCache(scoped, payload);
  const session = new PrintPreferenceSession(null, { storage, repository: {
    load: async () => { throw new Error('anonymous cannot read DB'); },
    save: async () => { throw new Error('anonymous cannot write DB'); },
  } });
  await session.load();
  assert.equal(session.getSnapshot().status, 'ready');
  assert.equal(session.getSnapshot().payload.settings.paperSize, 'letter');
  assert.equal(session.getSnapshot().payload.settings.rounds?.pageSize, 'letter');
  assert.equal(session.getSnapshot().payload.settings.rounds?.variant, 'twoColumn');
  assert.deepEqual(session.getSnapshot().payload.customCombinations, payload.customCombinations);
  assert.deepEqual(session.getSnapshot().payload.templatePresets, payload.templatePresets);
  assert.equal(session.getSnapshot().payload.settings.showNotesColumn, true);
  session.update('settings', previous => ({ ...previous, sectionSpacing: 12 }));
  assert.equal(readAnonymousPrintPreferences(scoped).settings.sectionSpacing, 12);
  session.stop();
});
