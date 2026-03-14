/**
 * Observability collector — single place for log/metric payloads.
 *
 * Current behavior:
 * - Logs and metrics are still emitted to console by the logger.
 * - This module buffers payloads when an ingest URL is configured.
 * - Set VITE_TELEMETRY_INGEST_URL in .env to enable batching and POST.
 *
 * To add a backend (Axiom, Datadog, Logtail, or your own endpoint):
 * 1. Set VITE_TELEMETRY_INGEST_URL in .env to your ingest endpoint.
 * 2. Ensure the endpoint accepts POST with JSON body (array of events).
 * 3. Optionally call flush() on visibility change or before unload to reduce loss.
 */

const MAX_BUFFER = 50;
const FLUSH_DEBOUNCE_MS = 5000;

type LogPayload = Record<string, unknown>;

const buffer: LogPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function getIngestUrl(): string | undefined {
  try {
    const u = typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEMETRY_INGEST_URL;
    return typeof u === 'string' && u.length > 0 ? u : undefined;
  } catch {
    return undefined;
  }
}

function scheduleFlush(): void {
  if (!getIngestUrl() || buffer.length === 0) return;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DEBOUNCE_MS);
}

/**
 * Push a log or metric payload into the collector. If ingest URL is set, buffers and may send.
 */
export function push(payload: LogPayload): void {
  if (!getIngestUrl()) return;
  buffer.push(payload);
  if (buffer.length >= MAX_BUFFER) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Send buffered payloads to the ingest URL. No-op if no URL configured or buffer empty.
 */
export async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  const url = getIngestUrl();
  if (!url) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true,
    });
  } catch {
    // Re-queue on failure so we don't lose events (up to one batch)
    if (buffer.length === 0) {
      batch.forEach((e) => buffer.push(e));
    }
  }
}

/**
 * Return current buffer size (for debugging or UI).
 */
export function getBufferSize(): number {
  return buffer.length;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { flush(); });
}
