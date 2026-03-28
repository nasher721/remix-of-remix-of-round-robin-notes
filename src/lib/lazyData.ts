/**
 * Lazy Data Loader
 *
 * Enables code-splitting for large static data files (IBCC, guidelines, etc.)
 * by loading them via dynamic import() instead of synchronous import.
 *
 * This moves large data (~200KB+ of JSON-like TS) out of the initial bundle
 * and into separate chunks that load asynchronously.
 */

import { useState, useEffect } from 'react';

type LazyDataState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

/**
 * Hook to lazy-load a module and extract a named export.
 *
 * @param loader - Dynamic import function, e.g. () => import('@/data/ibccContent')
 * @param selector - Function to extract the desired export from the module
 *
 * @example
 * const { data: chapters, loading } = useLazyData(
 *   () => import('@/data/ibccContent'),
 *   (mod) => mod.IBCC_CHAPTERS,
 * );
 */
export function useLazyData<TModule, TData>(
  loader: () => Promise<TModule>,
  selector: (mod: TModule) => TData,
): LazyDataState<TData> {
  const [state, setState] = useState<LazyDataState<TData>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    loader()
      .then((mod) => {
        if (!cancelled) {
          setState({ data: selector(mod), loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err : new Error('Failed to load lazy data'),
          });
        }
      });

    return () => { cancelled = true; };
  }, [loader, selector]);

  return state;
}

// ---------------------------------------------------------------------------
// Pre-built loaders for large data modules
// ---------------------------------------------------------------------------

// Cache resolved modules to avoid re-loading
let ibccCache: typeof import('@/data/ibccContent') | null = null;
let guidelinesCache: typeof import('@/data/clinicalGuidelinesData') | null = null;
let chapterContentCache: typeof import('@/data/ibccChapterContent') | null = null;

export async function loadIBCCData() {
  if (!ibccCache) {
    ibccCache = await import('@/data/ibccContent');
  }
  return ibccCache;
}

export async function loadGuidelinesData() {
  if (!guidelinesCache) {
    guidelinesCache = await import('@/data/clinicalGuidelinesData');
  }
  return guidelinesCache;
}

export async function loadChapterContent() {
  if (!chapterContentCache) {
    chapterContentCache = await import('@/data/ibccChapterContent');
  }
  return chapterContentCache;
}

/**
 * Preload data modules in the background.
 * Call this after the initial render to warm the cache without blocking.
 */
export function preloadClinicalData(): void {
  // Use requestIdleCallback where available, else setTimeout
  const schedule = typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (fn: () => void) => setTimeout(fn, 2000);

  schedule(() => {
    loadIBCCData().catch((err) => { console.error('[lazyData] Failed to load IBCC data:', err) });
    loadGuidelinesData().catch((err) => { console.error('[lazyData] Failed to load guidelines:', err) });
  });
}
