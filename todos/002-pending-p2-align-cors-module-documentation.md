---
status: pending
priority: p2
issue_id: "002"
tags: [code-review, documentation, compliance]
dependencies: []
source_review: "HEAD 163a9f0 — supabase/functions/_shared/cors.ts"
---

# Problem Statement

The module-level docblock states that origins must be explicitly whitelisted for HIPAA-oriented deployments, while the implementation now allows arbitrary `http://localhost:<port>`, `http://127.0.0.1:<port>`, and any `https://*.vercel.app` origin. Reviewers and auditors reading only the header will misunderstand the runtime policy.

## Findings

- **Location:** `supabase/functions/_shared/cors.ts` lines 1–8 (header) vs `getCorsHeaders` (lines 64–82).
- **Risk:** Operational misconfiguration — teams assume stricter defaults than implemented.

## Proposed Solutions

### Option A — Rewrite header to match behavior

- Document the three tiers: default list, env merge, and automatic patterns (local + Vercel).
- **Pros:** Single source of truth at top of file.
- **Cons:** None meaningful.
- **Effort:** Small | **Risk:** None

### Option B — Link to deployment doc

- Short header + pointer to `docs/deployment.md#cors` with full matrix.
- **Pros:** Keeps code comments short.
- **Cons:** Doc must stay in sync.
- **Effort:** Small | **Risk:** Low

## Recommended Action

_(Triage — prefer A + short link to deployment doc.)_

## Technical Details

- **Files:** `supabase/functions/_shared/cors.ts`, optionally `docs/deployment.md`

## Acceptance Criteria

- [ ] Header comment reflects localhost-any-port and Vercel preview behavior.
- [ ] HIPAA / PHI warning clarifies which origins are trusted and that `ALLOWED_ORIGINS` still merges.
- [ ] If Option B: deployment doc section exists and is accurate.

## Work Log

- 2026-03-21 — Created from post-merge code review of `163a9f0`.

## Resources

- Commit: `163a9f0`
