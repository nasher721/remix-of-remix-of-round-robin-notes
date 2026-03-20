/**
 * Optional Sentry client — no-ops when VITE_SENTRY_DSN is unset.
 * beforeSend scrubs URLs and avoids shipping request bodies (PHI-safe defaults).
 */

import * as Sentry from '@sentry/react';

let initialized = false;

function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return '[redacted]';
  }
}

/**
 * Call once from main.tsx after env is available.
 */
export function initAppSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || initialized) return;

  initialized = true;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        event.request.url = scrubUrl(event.request.url);
        delete event.request.data;
        delete event.request.cookies;
      }
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.stacktrace?.frames) {
            for (const frame of ex.stacktrace.frames) {
              if (frame.filename?.includes('patient') || frame.filename?.includes('Patient')) {
                frame.vars = undefined;
              }
            }
          }
        }
      }
      if (event.breadcrumbs) {
        for (const b of event.breadcrumbs) {
          if (b.data && typeof b.data === 'object') {
            delete (b.data as Record<string, unknown>).body;
            delete (b.data as Record<string, unknown>).payload;
          }
        }
      }
      return event;
    },
  });
}

export function captureExceptionToSentry(error: unknown, captureContext?: Sentry.CaptureContext): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.captureException(error, captureContext);
}

/** Non-PII metadata only — function name, HTTP status, attempts (no URLs with query, no bodies). */
export function captureEdgeFetchFailureToSentry(extra: Record<string, unknown>): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.captureMessage('edge_fetch_failed', {
    level: 'error',
    extra,
  });
}
