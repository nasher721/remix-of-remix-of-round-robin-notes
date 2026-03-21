---
status: pending
priority: p2
issue_id: "001"
tags: [code-review, security, compliance, supabase]
dependencies: []
source_review: "HEAD 163a9f0 — supabase/functions/_shared/cors.ts"
---

# Problem Statement

`getCorsHeaders` now treats any HTTPS origin ending in `.vercel.app` as allowed. That logic lives in **shared** CORS used by every edge function that calls `jsonResponse` / `handleOptions`, not only `healthcheck`.

The inline comment claims the exception is for healthcheck (no PHI), but the implementation widens CORS for **all** function responses that use this helper. For HIPAA-style deployments that relied on a tight browser origin allowlist, this increases cross-origin surface: any app deployed under `*.vercel.app` receives `Access-Control-Allow-Origin` for that requesting origin.

## Findings

- Evidence: `supabase/functions/_shared/cors.ts` lines 77–78: `(/^https:\/\//.test(origin) && /\.vercel\.app$/i.test(origin))`
- Same module is imported across edge functions (shared `jsonResponse`).
- Top-of-file documentation still emphasizes explicit allowlists and HIPAA-oriented origins, which is now partially contradicted by the broad Vercel rule.

## Proposed Solutions

### Option A — Env-gated relaxation (recommended)

- Add something like `RELAX_VERCEL_CORS=true` (default false in prod) or only enable when `ALLOWED_ORIGINS` includes a sentinel.
- **Pros:** Preview ergonomics without changing default security posture.
- **Cons:** Another secret to document; teams must set it for previews.
- **Effort:** Medium | **Risk:** Low

### Option B — Healthcheck-only permissive CORS

- Split helpers: stricter `getCorsHeaders` for PHI-capable functions; a narrow variant for `healthcheck` only.
- **Pros:** Matches the stated intent in the comment.
- **Cons:** Two code paths to maintain; easy to import the wrong helper.
- **Effort:** Medium | **Risk:** Medium (misuse)

### Option C — Tight regex + `ALLOWED_ORIGINS` only

- Remove the blanket `.vercel.app` rule; rely on merged `ALLOWED_ORIGINS` + existing named regexes.
- **Pros:** Smallest attack surface; aligns with file header.
- **Cons:** Previews break until origins are added to secrets.
- **Effort:** Small | **Risk:** Low for security, higher for DX

## Recommended Action

_(Triage during planning — suggest Option A or C for production HIPAA posture.)_

## Technical Details

- **Files:** `supabase/functions/_shared/cors.ts`, callers via `jsonResponse` / `handleOptions`
- **Deploy:** Requires redeploying all edge functions after change

## Acceptance Criteria

- [ ] Policy choice documented in `docs/deployment.md` or security notes (strict vs relaxed previews).
- [ ] Default production behavior matches chosen posture (env or split helper).
- [ ] Comment in `cors.ts` accurately describes scope (which functions / env affect it).

## Work Log

- 2026-03-21 — Created from post-merge code review of `163a9f0`.

## Resources

- Commit: `163a9f0` — fix: Backend banner false positives
- Related: `src/lib/edgeHealth.ts` (client probe; no PHI in healthcheck body)
