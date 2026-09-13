import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import * as React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { usePrintPreferences } from '../usePrintPreferences';
import { createDefaultPrintPreferences, writePrintPreferenceCache } from '@/lib/print/preferencePayload';
import { createScopedPrintStorage } from '@/lib/print/preferences';

declare global { var __SUPABASE_SELECT_MOCK__: unknown; }

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete globalThis.__SUPABASE_SELECT_MOCK__;
});

test('closed print preferences leave anonymous settings intact until opened, including Strict Mode', async () => {
  const payload = createDefaultPrintPreferences();
  payload.settings.paperSize = 'letter';
  payload.settings.printFontFamily = 'anonymous font';
  const storage = createScopedPrintStorage(null);
  writePrintPreferenceCache(storage, payload);
  const { result, rerender } = renderHook(({ open }) => usePrintPreferences(null, open), {
    initialProps: { open: false },
    wrapper: ({ children }: { children: React.ReactNode }) => <React.StrictMode>{children}</React.StrictMode>,
  });
  assert.equal(result.current.status, 'idle');
  assert.match(storage.getItem('payload')!, /anonymous font/);
  rerender({ open: true });
  await waitFor(() => assert.equal(result.current.status, 'ready'));
  assert.equal(result.current.settings.paperSize, 'letter');
  assert.equal(result.current.settings.printFontFamily, 'anonymous font');
  act(() => result.current.setSettings(previous => ({ ...previous, printFontFamily: 'edited font' })));
  assert.match(storage.getItem('payload')!, /edited font/);
});

test('hook changes owners immediately and ignores a delayed previous database response', async () => {
  let resolveA!: (value: unknown) => void;
  const pendingA = new Promise(resolve => { resolveA = resolve; });
  const payloadB = createDefaultPrintPreferences();
  payloadB.settings.printFontFamily = 'B font';
  globalThis.__SUPABASE_SELECT_MOCK__ = (query: { filters: { column: string; value: string }[] }) => {
    const owner = query.filters.find(filter => filter.column === 'user_id')?.value;
    return owner === 'a' ? pendingA : { data: { print_settings: payloadB }, error: null };
  };
  const { result, rerender } = renderHook(({ owner }) => usePrintPreferences(owner, true), { initialProps: { owner: 'a' } });
  assert.equal(result.current.status, 'loading');
  rerender({ owner: 'b' });
  await waitFor(() => assert.equal(result.current.status, 'ready'));
  assert.equal(result.current.settings.printFontFamily, 'B font');
  const payloadA = createDefaultPrintPreferences();
  payloadA.settings.printFontFamily = 'A private font';
  await act(async () => resolveA({ data: { print_settings: payloadA }, error: null }));
  assert.equal(result.current.settings.printFontFamily, 'B font');
  assert.doesNotMatch(createScopedPrintStorage('b').getItem('payload')!, /A private/);
});
