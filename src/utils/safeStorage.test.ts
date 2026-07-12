import assert from 'node:assert/strict';
import test from 'node:test';
import { createSafeStorage } from './safeStorage';

function withFakeLocalStorage(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  run: () => void,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: () => storage,
  });
  try {
    run();
  } finally {
    if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
  }
}

test('failed browser writes remain authoritative over stale browser values', () => {
  let browserValue: string | null = 'old-value';
  withFakeLocalStorage({
    getItem: () => browserValue,
    setItem: () => { throw new Error('quota exceeded'); },
    removeItem: () => { browserValue = null; },
  }, () => {
    const storage = createSafeStorage();
    storage.setItem('key', 'new-value');
    assert.equal(storage.getItem('key'), 'new-value');
  });
});

test('failed browser removals retain a tombstone over stale browser values', () => {
  withFakeLocalStorage({
    getItem: () => 'sensitive-old-value',
    setItem: () => undefined,
    removeItem: () => { throw new Error('storage blocked'); },
  }, () => {
    const storage = createSafeStorage();
    storage.removeItem('key');
    assert.equal(storage.getItem('key'), null);
  });
});

test('a later successful write replaces a removal tombstone', () => {
  let value: string | null = 'old-value';
  let removalBlocked = true;
  withFakeLocalStorage({
    getItem: () => value,
    setItem: (_key, nextValue) => { value = nextValue; },
    removeItem: () => {
      if (removalBlocked) throw new Error('storage blocked');
      value = null;
    },
  }, () => {
    const storage = createSafeStorage();
    storage.removeItem('key');
    assert.equal(storage.getItem('key'), null);

    removalBlocked = false;
    storage.setItem('key', 'replacement');
    assert.equal(storage.getItem('key'), 'replacement');
  });
});
