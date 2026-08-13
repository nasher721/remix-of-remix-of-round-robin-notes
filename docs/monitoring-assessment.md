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
| **Sync** | The owner-scoped queue emits aggregate length/oldest-age pressure plus replay duration, completed, failed, and conflict counts. No mutation payload is included. |
| **Patient fetch** | `usePatientFetch.ts` uses `logMetric('patients.fetch.error', 1, 'count', { userId })`. |
| **Cache metrics** | React Query + service worker: hits, misses, latency in `performanceMonitor.ts` and `CacheMonitorPanel`; not exported to a central backend. |
| **LLM metrics** | `LLMLogger.ts` — in-memory provider metrics (calls, errors, latency); not persisted or exported. |
| **Business metrics** | `src/types/analytics.ts` + `AnalyticsDashboard` / `MobileAnalytics` — unit/task/alert/protocol metrics computed from patient/todo data (in-app only). |
| **Public funnel** | `marketingTelemetry.ts` emits fixed PHI-free events for landing view, sign-in intent, feature exploration, security guidance, pricing/contact intent, email intent, and footer workspace intent through the optional collector. |
| **Health** | Supabase Edge Function `healthcheck` — DB ping + 200/503; suitable for UptimeRobot/Datadog. |

### Gaps

1. **Logs only go to console** — No log aggregation (e.g. Datadog, Logtail, Axiom). Production logs are not collected or queryable.
2. **Central collection is deployment-gated** — production now fails closed
   unless hosted Sentry or an approved same-origin/Supabase collector is
   configured. IndexedDB remains the local diagnostic store.
3. **Request IDs are partial** — Patient fetches and selected API/Edge paths carry correlation IDs; complete browser-to-Edge propagation is still incremental.
4. **Edge metrics are partial** — Shared structured safe logging exists, but not every function emits full rate/error/duration measurements.
5. **RED coverage is partial** — Patient fetch, authentication, patient mutation, and offline replay measurements are emitted; a configured backend is still needed to aggregate them.
6. **Alert rules are deployment work** — Repository code emits the required fixed metrics, but production thresholds and notification destinations are not configured here.

### Critical paths to monitor

| Path | SLI idea | Current coverage |
|------|----------|------------------|
| Patient load | Success rate, p95 latency | `logMetric` on fetch error only; no success/duration. |
| Patient mutations | Outcome count, average latency | Fixed `patients.mutation.*` metrics; saved/queued per-input writes aggregate over five seconds, conflicts and hard errors emit immediately. |
| Edge Functions (AI, format, etc.) | Invocations, errors, duration | Not instrumented. |
| Public launch funnel | Landing → feature/sign-in/contact intent | Fixed PHI-free events; centrally visible only when collector ingest is configured. |
| Auth | Login outcome count, average latency | Password success and fixed failure categories plus approved-provider OAuth redirect/error outcomes emit `auth.sign_in.*`; OAuth is hidden unless deployment-allowlisted, and background session-restoration failures remain console-only. |
| Offline sync | Queue length/age, sync success/failure/conflict | Fixed `offline.sync.*` queue-pressure and replay-result metrics. |
| Global errors | Count by fingerprint, trend | Telemetry + frequency in-memory + IndexedDB; not aggregated. |

---

## Step 2: Instrument (done)

- **Request IDs:** `generateRequestId()` in `src/lib/observability/logger.ts`; use in log/telemetry context for correlation.
- **Patient fetch:** `usePatientFetch` now logs:
  - `patients.fetch.duration_ms` (with `requestId`, `count`, `status: success|error`)
  - `patients.fetch.success` (1 per success)
  - `patients.fetch.error` unchanged, now includes `requestId`.
- **Patient mutations:** add, update, remove, duplicate, collapse-all, and clear-all emit:
  - `patients.mutation.duration_ms` (average duration plus aggregate count)
  - `patients.mutation.total` (count by fixed operation/outcome)
  - Saved and queued per-input writes coalesce for five seconds; conflict and hard-error outcomes emit immediately.
- **Offline sync:** the owner-scoped queue and replay engine emit:
  - `offline.sync.queue_length`, `offline.sync.oldest_age_ms`
  - `offline.sync.duration_ms`, `offline.sync.completed`,
    `offline.sync.failed`, `offline.sync.conflicts`
  - Rapid enqueue pressure publishes the latest aggregate snapshot once per
    five seconds; sync start/completion/error snapshots remain immediate.
- **Edge Functions:** `format-medications` logs `requestId`, `function: 'format-medications'`, `durationMs`, `status: success|error`; use as template for other functions.
- **Public funnel:** `marketingTelemetry.ts` uses a compile-time and runtime-fixed
  event vocabulary. Events contain only a funnel classification and the shared
  pseudonymous tab-session identifier—never form, contact, account, or patient
  content.
- **Authentication:** `authTelemetry.ts` emits `auth.sign_in.duration_ms` and
  `auth.sign_in.total` with only fixed method/outcome classifications. Email,
  password, account id, redirect URL, and upstream provider messages cannot be
  attached at this API boundary.
- **Not yet done:** Web Vitals and full RED coverage for every Edge Function.

---

## Step 3: Collect (done)

- **Current flow:** Keep console + IndexedDB; add a “Export logs” or “Send last N errors” for support.
- **Collector** (`src/lib/observability/collector.ts`): Buffers payloads; when `VITE_TELEMETRY_INGEST_URL` is set, batches (max 50) and POSTs every 5s or on buffer full. Concurrent flushes serialize, non-2xx/network failures requeue, retained memory is capped at 200 sanitized events, and `pagehide` flushes the final mutation aggregate before delivery.
- **Telemetry** (errors) remains in IndexedDB; use existing **Export error report** for support.
- **Backend requirement:** Production requires hosted Sentry or
  `VITE_TELEMETRY_INGEST_URL`. The custom endpoint should accept POST with a
  JSON array of events and must be same-origin or Supabase-hosted so CSP cannot
  silently block delivery. When Sentry is used, the operational bridge emits
  only fixed tags and bounded numeric measurements.
- **Launch analytics:** Once an approved ingest endpoint is configured, chart
  `marketing.landing_view` → sign-in/contact intent → `auth.sign_in.total`.
  The code emits no cookies and does not send page content, email addresses,
  credentials, account identifiers, or clinical data.

---

## Step 4: Visualize (done)

- **Business metrics:** Use existing **AnalyticsDashboard** / **MobileAnalytics** for unit, task, alert, and protocol metrics.
- **Cache:** **CacheMonitorPanel** shows React Query + service worker hit rate and latency.
- **Errors:** Use `getErrorFrequencies()` and `exportErrorReport()` from telemetry (wire to a Settings/Debug menu for support). No in-app ops dashboard yet; add one (RED for API/Edge, error rate, sync) when you have a telemetry backend.

---

## Step 5: Alert (done — documented)

- **Uptime / health:** Use the Supabase Edge Function `healthcheck` (DB ping). In UptimeRobot or Datadog, add an HTTP monitor to your `.../functions/v1/healthcheck` URL with the `x-healthcheck-token` secret header; alert on 401, 5xx, or timeout.
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

Steps 1–5 have repository support. You have: assessment and gaps, request IDs
and success/duration metrics on patient fetch, authentication, patient writes,
and sync; a failure-safe collector; a PHI-safe Sentry operational bridge;
existing in-app dashboards; and documented alerting. Sink provisioning,
receipt verification, and production alert rules remain deployment gates.

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
