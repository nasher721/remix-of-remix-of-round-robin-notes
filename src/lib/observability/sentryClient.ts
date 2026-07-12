/**
 * Optional Sentry client — no-ops when VITE_SENTRY_DSN is unset.
 * beforeSend scrubs URLs and avoids shipping request bodies (PHI-safe defaults).
 */

import * as Sentry from '@sentry/react';

type CaptureExceptionContext = Parameters<typeof Sentry.captureException>[1];

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
    // Performance spans can capture request URLs containing clinical record
    // identifiers. Keep tracing disabled until every transaction/span surface
    // has a tested scrubber; error events still pass through beforeSend below.
    integrations: [],
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      event.message = event.message ? 'client_error' : undefined;
      event.user = undefined;
      event.extra = undefined;
      event.tags = undefined;
      event.contexts = undefined;
      if (event.request) {
        event.request.url = scrubUrl(event.request.url);
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.env;
        delete event.request.query_string;
      }
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          ex.value = 'client_error';
          if (ex.stacktrace?.frames) {
            for (const frame of ex.stacktrace.frames) {
              frame.vars = undefined;
            }
          }
        }
      }
      if (event.breadcrumbs) {
        for (const b of event.breadcrumbs) {
          b.message = undefined;
          b.data = undefined;
        }
      }
      return event;
    },
  });
}

export function captureExceptionToSentry(error: unknown, captureContext?: CaptureExceptionContext): void {
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
