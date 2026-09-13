import type { StorageLike } from '@/utils/safeStorage';
import { createScopedPrintStorage, getAuthenticatedPrintPayload, quarantineLegacyPrintPreferences } from './preferences';
import {
  createDefaultPrintPreferences,
  normalizePrintPreferences,
  readAnonymousPrintPreferences,
  writePrintPreferenceCache,
  type PrintPreferencePayload,
} from './preferencePayload';

export interface PrintPreferenceRepository {
  load(ownerId: string): Promise<unknown | null>;
  save(ownerId: string, payload: PrintPreferencePayload): Promise<void>;
}

export interface PrintPreferenceSnapshot {
  payload: PrintPreferencePayload;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

interface SessionOptions {
  storage: StorageLike;
  repository: PrintPreferenceRepository;
  debounceMs?: number;
  onError?: (operation: 'load' | 'save') => void;
}

/**
 * One immutable owner per session. The browser is authoritative only for anonymous
 * use. Loaded database settings, queued writes, and late replies cannot cross owners.
 */
export class PrintPreferenceSession {
  private snapshot: PrintPreferenceSnapshot = { payload: createDefaultPrintPreferences(), status: 'idle' };
  private listeners = new Set<() => void>();
  private storage: StorageLike;
  private generation = 0;
  private active = true;
  private dirty = false;
  private saving = false;
  private pendingChanges: Array<(payload: PrintPreferencePayload) => PrintPreferencePayload> = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(readonly ownerId: string | null, private options: SessionOptions) {
    this.storage = createScopedPrintStorage(ownerId, options.storage);
  }

  getSnapshot = (): PrintPreferenceSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(snapshot: PrintPreferenceSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }

  /** Reusable after effect cleanup, including React Strict Mode's effect replay. */
  start(): void { this.active = true; }

  cancelLoad(): void {
    this.generation += 1;
    if (this.snapshot.status === 'loading') {
      this.publish({ payload: createDefaultPrintPreferences(), status: 'idle' });
    }
  }

  stop(): void {
    this.active = false;
    this.cancelLoad();
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  async load(): Promise<void> {
    if (!this.active || this.snapshot.status === 'ready' || this.snapshot.status === 'loading') return;
    const generation = ++this.generation;
    const isCurrent = () => this.active && this.generation === generation;
    this.dirty = false;
    this.pendingChanges = [];
    this.publish({ payload: createDefaultPrintPreferences(), status: 'loading' });
    quarantineLegacyPrintPreferences(this.options.storage);

    try {
      if (this.ownerId === null) {
        const payload = readAnonymousPrintPreferences(this.storage);
        if (isCurrent()) this.publish({ payload, status: 'ready' });
        return;
      }

      const databasePayload = await this.options.repository.load(this.ownerId);
      if (!isCurrent()) return;
      const decision = getAuthenticatedPrintPayload(databasePayload, createDefaultPrintPreferences());
      const payload = normalizePrintPreferences(decision.payload);
      // The controls remain usable while loading. Replay choices on top of the
      // authoritative row, so an early edit neither disappears nor replaces
      // unrelated saved settings with the temporary defaults shown by the UI.
      const editedPayload = this.pendingChanges.reduce((current, change) => change(current), payload);
      this.pendingChanges = [];
      this.publish({ payload: editedPayload, status: 'loading' });
      // Initialization must finish before edits can be persisted. Otherwise a slow
      // defaults write could land after a newer customization and overwrite it.
      if (decision.shouldInitializeDatabase) await this.options.repository.save(this.ownerId, payload);
      if (!isCurrent()) return;
      this.pendingChanges = [];
      this.publish({ payload: this.snapshot.payload, status: 'ready' });
      writePrintPreferenceCache(this.storage, this.snapshot.payload);
      if (this.dirty) this.scheduleSave();
    } catch {
      if (!isCurrent()) return;
      this.publish({ payload: this.snapshot.payload, status: 'error' });
      this.options.onError?.('load');
    }
  }

  update<K extends keyof PrintPreferencePayload>(
    field: K,
    update: PrintPreferencePayload[K] | ((previous: PrintPreferencePayload[K]) => PrintPreferencePayload[K]),
  ): void {
    if (!this.active) return;
    const change = (current: PrintPreferencePayload): PrintPreferencePayload => ({
      ...current,
      [field]: typeof update === 'function' ? update(current[field]) : update,
    });
    const payload = change(this.snapshot.payload);
    if (this.snapshot.status === 'loading') this.pendingChanges.push(change);
    this.dirty = true;
    this.publish({ ...this.snapshot, payload });
    // A failed or incomplete load must never cause defaults or cached settings to
    // overwrite an account's row. Reopening the modal permits an explicit retry.
    if (this.snapshot.status !== 'ready') return;
    writePrintPreferenceCache(this.storage, payload);
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (!this.ownerId || !this.active) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, this.options.debounceMs ?? 1000);
  }

  /** Serialize writes so an older request can never land after the latest one. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.active || !this.ownerId || this.snapshot.status !== 'ready' || this.saving || !this.dirty) return;
    this.saving = true;
    try {
      while (this.active && this.dirty && this.snapshot.status === 'ready') {
        this.dirty = false;
        await this.options.repository.save(this.ownerId, this.snapshot.payload);
      }
    } catch {
      this.dirty = true;
      this.options.onError?.('save');
    } finally {
      this.saving = false;
    }
  }
}
