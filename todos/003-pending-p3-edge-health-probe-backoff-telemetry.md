---
status: pending
priority: p3
issue_id: "003"
tags: [code-review, performance, observability]
dependencies: []
source_review: "HEAD 163a9f0 — src/lib/edgeHealth.ts"
---

# Problem Statement

`probeEdgeHealth` runs up to three sequential attempts with a fixed 400 ms gap. On repeated failure, worst-case latency grows (~3 × invoke timeout + delays). There is no structured log or metric distinguishing **CORS / 4xx** vs **503 / timeout** vs **unknown**, which makes production diagnosis harder when the banner appears.

## Findings

- **File:** `src/lib/edgeHealth.ts` — `PROBE_ATTEMPTS`, `PROBE_RETRY_DELAY_MS`, `runSingleProbe`.
- **Context:** `EdgeHealthContext` also calls `probeEdgeHealth({ force: true })` every 120 s; retries multiply wall time on unhealthy paths.
- **Impact:** Mostly UX / support time — not a correctness bug.

## Proposed Solutions

### Option A — Jittered exponential backoff

- Replace flat 400 ms with e.g. 200 / 400 / 800 ms capped.
- **Pros:** Reduces thundering herd if many tabs open.
- **Cons:** Slightly slower recovery perception.
- **Effort:** Small | **Risk:** Low

### Option B — Telemetry on final failure

- On last failed attempt, `recordTelemetryEvent` with coarse reason (`invoke_error`, `non_healthy_body`, `timeout`) without logging PHI.
- **Pros:** Faster RCA in observability tooling.
- **Cons:** Slightly more code; must avoid PII in payloads.
- **Effort:** Small | **Risk:** Low

### Option C — No change

- Accept current behavior for simplicity.
- **Effort:** None

## Recommended Action

_(Triage — optional P3; pick B if support noise about banner persists.)_

## Technical Details

- **Files:** `src/lib/edgeHealth.ts`, optionally `src/lib/observability/telemetry.ts` patterns

## Acceptance Criteria

- [ ] If implemented: backoff or telemetry covered by a short unit test or manual test notes.
- [ ] No new PII in telemetry payloads.

## Work Log

- 2026-03-21 — Created from post-merge code review of `163a9f0`.

## Resources

- Commit: `163a9f0`
- Consumer: `src/contexts/EdgeHealthContext.tsx`, `src/components/BackendStatusBanner.tsx`
