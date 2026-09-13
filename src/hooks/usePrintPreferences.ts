import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { PrintPreferenceSession } from '@/lib/print/preferenceSession';
import type { PrintPreferencePayload } from '@/lib/print/preferencePayload';
import { printPreferenceRepository } from '@/services/printPreferenceRepository';
import { safeLocalStorage } from '@/utils/safeStorage';

type Update<T> = T | ((previous: T) => T);

/** UI settings and setters, with all persistence bound to this authenticated owner. */
export function usePrintPreferences(ownerId: string | null, open: boolean) {
  const session = useMemo(() => new PrintPreferenceSession(ownerId, {
    repository: printPreferenceRepository,
    storage: safeLocalStorage,
    onError: operation => console.error(`Failed to ${operation} print settings`),
  }), [ownerId]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);

  useEffect(() => {
    if (open) void session.load();
    return () => session.cancelLoad();
  }, [session, open]);

  const setters = useMemo(() => ({
    setSettings: (value: Update<PrintPreferencePayload['settings']>) => session.update('settings', value),
    setCustomCombinations: (value: Update<PrintPreferencePayload['customCombinations']>) => session.update('customCombinations', value),
    setTemplatePresets: (value: Update<PrintPreferencePayload['templatePresets']>) => session.update('templatePresets', value),
    setSelectedTemplateId: (value: Update<PrintPreferencePayload['selectedTemplateId']>) => session.update('selectedTemplateId', value),
  }), [session]);

  return { ...state.payload, status: state.status, ...setters };
}
