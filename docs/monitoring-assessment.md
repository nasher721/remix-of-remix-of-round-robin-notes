# Monitoring assessment — Round Robin Notes

Step-by-step plan following **Assess → Instrument → Collect → Visualize → Alert**.

---

## Step 1: Assess (current state)

### What exists

| Area | What you have |
|------|----------------|
| **Structured logging** | `src/lib/observability/logger.ts` — JSON logs with `app`, `env`, `sessionId`, `timestamp`, `level`, `message`, `context`. No Pino; output is `console.log/warn/error`. |
| **Telemetry / errors** | `src/lib/observability/telemetry.ts` — Persists events to IndexedDB, fingerprinting, frequency tracking, `recordTelemetryEvent()`, PHI-safe `sanitizeContext()`. |
| **Global error capture** | `initGlobalErrorCapture()` in `main.tsx` — unhandled errors and unhandled promise rejections → telemetry. |
| **Render errors** | `GlobalErrorBoundary` uses `recordTelemetryEvent('render_error', …)`. |
| **API errors** | `apiClient.ts` records `api_error` / `network_error` via telemetry; circuit breaker + retries. |
| **Request timeouts** | `requestTimeout.ts` records `network_error` on timeout. |
| **AI errors** | `useAIClinicalAssistant` records `ai_error`. |
| **Sync** | `syncService.ts` uses `logMetric('offline.sync.queue_length', …)`. |
| **Patient fetch** | `usePatientFetch.ts` uses `logMetric('patients.fetch.error', 1, 'count', { userId })`. |
| **Cache metrics** | React Query + service worker: hits, misses, latency in `performanceMonitor.ts` and `CacheMonitorPanel`; not exported to a central backend. |
| **LLM metrics** | `LLMLogger.ts` — in-memory provider metrics (calls, errors, latency); not persisted or exported. |
| **Business metrics** | `src/types/analytics.ts` + `AnalyticsDashboard` / `MobileAnalytics` — unit/task/alert/protocol metrics computed from patient/todo data (in-app only). |
| **Health** | Supabase Edge Function `healthcheck` — DB ping + 200/503; suitable for UptimeRobot/Datadog. |

### Gaps

1. **Logs only go to console** — No log aggregation (e.g. Datadog, Logtail, Axiom). Production logs are not collected or queryable.
2. **Telemetry is client-only** — IndexedDB is per-device; no server-side aggregation, so you can’t see error rates or trends across users.
3. **No request IDs** — Hard to correlate frontend logs with Supabase/Edge Function logs.
4. **Edge Functions** — No structured logging or metrics in Edge Functions (e.g. `format-medications`, `generate-daily-summary`); only healthcheck does a DB ping.
5. **No RED metrics** — No central place for rate/errors/duration of API or Edge Function calls.
6. **No alerting** — No thresholds or notifications when error rate or latency degrades.

### Critical paths to monitor

| Path | SLI idea | Current coverage |
|------|----------|------------------|
| Patient load | Success rate, p95 latency | `logMetric` on fetch error only; no success/duration. |
| Patient mutations | Success rate, latency | No instrumentation. |
| Edge Functions (AI, format, etc.) | Invocations, errors, duration | Not instrumented. |
| Auth | Login/signup success, session errors | No explicit telemetry. |
| Offline sync | Queue length, sync success/failure | `logMetric` queue length; no success/failure rate. |
| Global errors | Count by fingerprint, trend | Telemetry + frequency in-memory + IndexedDB; not aggregated. |

---

## Step 2: Instrument (done)

- **Request IDs:** `generateRequestId()` in `src/lib/observability/logger.ts`; use in log/telemetry context for correlation.
- **Patient fetch:** `usePatientFetch` now logs:
  - `patients.fetch.duration_ms` (with `requestId`, `count`, `status: success|error`)
  - `patients.fetch.success` (1 per success)
  - `patients.fetch.error` unchanged, now includes `requestId`.
- **Offline sync:** `syncService.syncAll()` now logs:
  - `offline.sync.duration_ms` (with total, completed, failed, skipped)
  - `offline.sync.completed`, `offline.sync.failed`, `offline.sync.skipped` (counts).
- **Edge Functions:** `format-medications` logs `requestId`, `function: 'format-medications'`, `durationMs`, `status: success|error`; use as template for other functions.
- **Not yet done:** Web Vitals, patient mutation hooks (optional follow-up).

---

## Step 3: Collect (done)

- **Current flow:** Keep console + IndexedDB; add a “Export logs” or “Send last N errors” for support.
- **Collector** (`src/lib/observability/collector.ts`): Buffers payloads; when `VITE_TELEMETRY_INGEST_URL` is set, batches (max 50) and POSTs every 5s or on buffer full; flushes on `pagehide`.
- **Telemetry** (errors) remains in IndexedDB; use existing **Export error report** for support.
- **To add a backend:** Set `VITE_TELEMETRY_INGEST_URL` to your ingest endpoint; it should accept POST with JSON array of events.

---

## Step 4: Visualize (done)

- **Business metrics:** Use existing **AnalyticsDashboard** / **MobileAnalytics** for unit, task, alert, and protocol metrics.
- **Cache:** **CacheMonitorPanel** shows React Query + service worker hit rate and latency.
- **Errors:** Use `getErrorFrequencies()` and `exportErrorReport()` from telemetry (wire to a Settings/Debug menu for support). No in-app ops dashboard yet; add one (RED for API/Edge, error rate, sync) when you have a telemetry backend.

---

## Step 5: Alert (done — documented)

- **Uptime / health:** Use existing Supabase Edge Function `healthcheck` (DB ping). In UptimeRobot or Datadog, add an HTTP monitor to your `.../functions/v1/healthcheck` URL; alert on 5xx or timeout.
- **Error rate:** When you add a telemetry backend, add an alert when error rate > 5% on a critical path. Example (Prometheus-style):

```yaml
# Example: when you have metrics in a backend
- alert: HighErrorRate
  expr: rate(patients_fetch_errors_total[5m]) / rate(patients_fetch_requests_total[5m]) > 0.05
  for: 2m
  annotations:
    summary: "Patient fetch error rate above 5%"
```

- **Client-side:** Optional in-app banner or support report when `getErrorFrequencies()` shows a spike (e.g. same fingerprint > N times in session).

---

## Summary

Steps 1–5 are complete. You have: assessment and gaps, request IDs and success/duration metrics on patient fetch and sync, a collector for optional ingest URL, existing dashboards for visualization, and documented alerting (healthcheck + optional error-rate and client-side alerts).

### Follow-up: local monitoring UX (errors → fixes)

| Piece | Purpose |
|-------|---------|
| **`breadcrumbs.ts`** | In-memory trail (`nav` = pathname only). Attached to every stored telemetry event as `recentBreadcrumbs` for repro steps. |
| **`exportDiagnosticsReport()`** | JSON bundle: errors with **stack previews**, **fingerprints**, `fixHints`, breadcrumbs, session id, build mode. Use for tickets or local grep. |
| **`window.__RR_OBSERVABILITY__`** | `exportReport()`, `copyReport()`, `getFrequencies()`, `getRecentEvents()`, `clearAll()` — installed from `main.tsx`. |
| **`ObservabilitySupportCard`** | Settings (desktop utility **Settings** tab, mobile **Settings**): copy diagnostics / clear local DB. |
| **`NavigationBreadcrumbTracker`** | React Router pathname logging inside `App.tsx`. |
| **`captureHandledError(err, extra)`** | Try/catch paths: same pipeline as global errors (`handled_error` category). |
| **Error boundaries** | `AIErrorBoundary`, `LazyPanelErrorBoundary`, `ErrorBoundary`, section boundaries, and global fallback record `render_error` with boundary metadata. |

**Triage workflow:** reproduce → Settings → **Copy diagnostics** (or console `await __RR_OBSERVABILITY__.exportReport()`) → search codebase using `message` / `stackPreview` / `fingerprint`. Optional: set `VITE_TELEMETRY_INGEST_URL` so structured logger batches hit your backend.
