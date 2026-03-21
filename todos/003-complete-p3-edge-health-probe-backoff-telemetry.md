---
status: complete
priority: p3
issue_id: "003"
tags: [code-review, performance, observability]
dependencies: []
source_review: "HEAD 163a9f0 — src/lib/edgeHealth.ts"
---

# Problem Statement

`probeEdgeHealth` runs up to three sequential attempts with a fixed 400 ms gap. On repeated failure, worst-case latency grows (~3 × invoke timeout + delays). There is no structured log or metric distinguishing **CORS / 4xx** vs **503 / timeout** vs **unknown**, which makes production diagnosis harder when the banner appears.

## Resolution

- **Backoff:** Retries use `200 * 2^(attempt-1)` ms between attempts, capped at **800 ms** (second gap 200 ms, third 400 ms).
- **Telemetry:** After all attempts fail, `recordTelemetryEvent('network_error', 'edge_health_probe_exhausted', { attempts, outcome, reason })` with coarse reasons: `invoke_error`, `unexpected_body`, `timeout`, `exception` (no PHI).

## Findings

- **File:** `src/lib/edgeHealth.ts` — `PROBE_ATTEMPTS`, `runSingleProbe`.
- **Context:** `EdgeHealthContext` also calls `probeEdgeHealth({ force: true })` every 120 s; retries multiply wall time on unhealthy paths.
- **Impact:** Mostly UX / support time — not a correctness bug.

## Proposed Solutions

### Option A — Jittered exponential backoff — **DONE**

### Option B — Telemetry on final failure — **DONE**

### Option C — No change

## Recommended Action

If telemetry volume is high, add sampling later.

## Technical Details

- **Files:** `src/lib/edgeHealth.ts`

## Acceptance Criteria

- [x] If implemented: backoff or telemetry covered by a short unit test or manual test notes. *(Manual: open app with edge down / throttled; check telemetry store / export.)*
- [x] No new PII in telemetry payloads.

## Work Log

- 2026-03-21 — Created from post-merge code review of `163a9f0`.
- 2026-03-21 — Exponential backoff + `recordTelemetryEvent` on exhausted probes; `TimeoutError` distinguished from other exceptions.

## Resources

- Commit: `163a9f0`
- Consumer: `src/contexts/EdgeHealthContext.tsx`, `src/components/BackendStatusBanner.tsx`
