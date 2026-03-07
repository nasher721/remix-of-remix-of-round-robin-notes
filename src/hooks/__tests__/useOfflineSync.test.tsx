import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineSync } from '../useOfflineSync';
import { createHookWrapper } from '@/test/utils';

// Mock the IndexedDB queue
const mockGetQueueSize = vi.fn();
const mockClear = vi.fn();
const mockGetQueue = vi.fn();

vi.mock('@/lib/offline/indexedDBQueue', () => ({
  indexedDBQueue: {
    getQueueSize: () => mockGetQueueSize(),
    clear: () => mockClear(),
    getQueue: () => mockGetQueue(),
  },
}));

// Mock sync engine
const mockSync = vi.fn();
const mockOn = vi.fn();
const mockGetSyncEngine = vi.fn();

vi.mock('@/lib/offline/syncEngine', () => ({
  getSyncEngine: () => mockGetSyncEngine(),
}));

describe('useOfflineSync', () => {
  let eventHandlers: Record<string, (() => void) | ((data: unknown) => void)> = {};
  let unsubscribers: (() => void)[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers = {};
    unsubscribers = [];

    // Mock sync engine
    mockOn.mockImplementation((event: string, handler: () => void) => {
      eventHandlers[event] = handler;
      const unsub = vi.fn();
      unsubscribers.push(unsub);
      return unsub;
    });

    mockGetSyncEngine.mockReturnValue({
      sync: mockSync,
      on: mockOn,
    });

    // Default mock returns
    mockGetQueueSize.mockResolvedValue(0);
    mockGetQueue.mockResolvedValue([]);
    mockSync.mockResolvedValue({
      success: 1,
      processed: 5,
      succeeded: 5,
      failed: 0,
      conflicts: [],
      duration: 1000,
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.conflicts).toEqual([]);
    expect(result.current.syncError).toBeNull();
    expect(result.current.lastSyncAt).toBeNull();
  });

  it('should track online status', async () => {
    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    expect(result.current.isOnline).toBe(true);

    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(false);
    });

    // Simulate coming back online
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(true);
    });
  });

  it('should update queue size on mount', async () => {
    mockGetQueueSize.mockResolvedValue(5);

    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    await waitFor(() => {
      expect(result.current.queueSize).toBe(5);
    });

    expect(mockGetQueueSize).toHaveBeenCalled();
  });

  it('should track syncing state via syncEngine events', async () => {
    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    // Start with syncing state from event
    act(() => {
      if (eventHandlers['status-change']) {
        (eventHandlers['status-change'] as (status: string) => void)('syncing');
      }
    });
    expect(result.current.isSyncing).toBe(true);

    // Mark as idle (simulating sync completion)
    act(() => {
      if (eventHandlers['status-change']) {
        (eventHandlers['status-change'] as (status: string) => void)('idle');
      }
    });
    expect(result.current.isSyncing).toBe(false);

    // Complete event updates lastSyncAt
    act(() => {
      if (eventHandlers['complete']) {
        (eventHandlers['complete'] as () => void)();
      }
    });
    expect(result.current.lastSyncAt).not.toBeNull();
  });

  it('should handle sync progress updates', async () => {
    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    act(() => {
      if (eventHandlers['progress']) {
        (eventHandlers['progress'] as (data: { current: number; total: number }) => void)({
          current: 3,
          total: 5,
        });
      }
    });

    expect(result.current.syncProgress).toEqual({ current: 3, total: 5 });
  });

  it('should handle conflicts', async () => {
    const mockConflicts = [
      { id: '1', field: 'name', localValue: 'John', serverValue: 'Jane' },
    ];

    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    act(() => {
      if (eventHandlers['conflict']) {
        (eventHandlers['conflict'] as (conflicts: unknown[]) => void)(mockConflicts);
      }
    });

    expect(result.current.conflicts).toEqual(mockConflicts);
  });

  it('should handle sync errors', async () => {
    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    act(() => {
      if (eventHandlers['error']) {
        (eventHandlers['error'] as (error: Error) => void)(new Error('Network timeout'));
      }
    });

    expect(result.current.syncError).toBe('Network timeout');
    expect(result.current.isSyncing).toBe(false);
  });

  it('should trigger manual sync', async () => {
    mockSync.mockResolvedValue({
      success: 1,
      processed: 3,
      succeeded: 3,
      failed: 0,
      conflicts: [],
      duration: 500,
    });

    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    let syncResult;
    await act(async () => {
      syncResult = await result.current.sync();
    });

    expect(mockSync).toHaveBeenCalled();
    expect(syncResult).toEqual({
      success: 1,
      processed: 3,
      succeeded: 3,
      failed: 0,
      conflicts: [],
      duration: 500,
    });
    expect(result.current.lastSyncAt).not.toBeNull();
  });

  it('should not sync when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    let syncResult;
    await act(async () => {
      syncResult = await result.current.sync();
    });

    expect(mockSync).not.toHaveBeenCalled();
    expect(syncResult).toEqual({
      success: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      conflicts: [],
      duration: 0,
    });
  });

  it('should prevent concurrent sync calls', async () => {
    // Setup mock that never resolves to simulate ongoing sync
    mockSync.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    // Manually set syncing state via event (simulating what sync() does)
    act(() => {
      if (eventHandlers['status-change']) {
        (eventHandlers['status-change'] as (status: string) => void)('syncing');
      }
    });
    
    // Now try to sync again - should return empty result
    const secondResult = await result.current.sync();
    
    // Second sync should return empty result because isSyncing is true
    expect(secondResult.succeeded).toBe(0);
    expect(secondResult.processed).toBe(0);
  });

  it('should handle sync failure', async () => {
    mockSync.mockRejectedValue(new Error('Sync failed'));

    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    let syncResult;
    await act(async () => {
      syncResult = await result.current.sync();
    });

    expect(result.current.syncError).toBe('Sync failed');
    expect(result.current.isSyncing).toBe(false);
    expect(syncResult).toEqual({
      success: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      conflicts: [],
      duration: 0,
    });
  });

  it('should clear queue', async () => {
    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    await act(async () => {
      await result.current.clearQueue();
    });

    expect(mockClear).toHaveBeenCalled();
    expect(result.current.queueSize).toBe(0);
    expect(result.current.conflicts).toEqual([]);
  });

  it('should get queued mutations', async () => {
    const mockMutations = [
      { id: '1', type: 'update', table: 'patients', data: {} },
    ];
    mockGetQueue.mockResolvedValue(mockMutations);

    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    const mutations = await result.current.getQueuedMutations();

    expect(mockGetQueue).toHaveBeenCalled();
    expect(mutations).toEqual(mockMutations);
  });

  it('should set up subscriptions on mount', () => {
    renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    // Verify that the syncEngine.on was called for each event type
    expect(mockOn).toHaveBeenCalledWith('status-change', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('progress', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('conflict', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('complete', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
