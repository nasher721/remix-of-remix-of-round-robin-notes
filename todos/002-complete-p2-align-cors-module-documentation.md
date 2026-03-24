---
status: complete
priority: p2
issue_id: "002"
tags: [code-review, documentation, compliance]
dependencies: []
source_review: "HEAD 163a9f0 — supabase/functions/_shared/cors.ts"
---

# Problem Statement

The module-level docblock states that origins must be explicitly whitelisted for HIPAA-oriented deployments, while the implementation now allows arbitrary `http://localhost:<port>`, `http://127.0.0.1:<port>`, and any `https://*.vercel.app` origin. Reviewers and auditors reading only the header will misunderstand the runtime policy.

## Resolution

Replaced the header in `cors.ts` with a layered description: defaults + `ALLOWED_ORIGINS`, named Vercel regexes, localhost any-port, and optional `RELAX_VERCEL_CORS` for blanket Vercel previews. Cross-linked behavior in `docs/deployment.md` (CORS section).

## Findings

- **Location:** `supabase/functions/_shared/cors.ts` lines 1–8 (header) vs `getCorsHeaders` (lines 64–82).
- **Risk:** Operational misconfiguration — teams assume stricter defaults than implemented.

## Proposed Solutions

### Option A — Rewrite header to match behavior — **DONE**

### Option B — Link to deployment doc — **DONE** (both)

## Recommended Action

Keep `cors.ts` header and `docs/deployment.md` in sync when adding new origin rules.

## Technical Details

- **Files:** `supabase/functions/_shared/cors.ts`, `docs/deployment.md`

## Acceptance Criteria

- [x] Header comment reflects localhost-any-port and Vercel preview behavior.
- [x] HIPAA / PHI warning clarifies which origins are trusted and that `ALLOWED_ORIGINS` still merges.
- [x] If Option B: deployment doc section exists and is accurate.

## Work Log

- 2026-03-21 — Created from post-merge code review of `163a9f0`.
- 2026-03-21 — Header rewritten; deployment CORS section updated for `RELAX_VERCEL_CORS` and localhost.

## Resources

- Commit: `163a9f0`
