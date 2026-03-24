---
status: complete
priority: p2
issue_id: "001"
tags: [code-review, security, compliance, supabase]
dependencies: []
source_review: "HEAD 163a9f0 — supabase/functions/_shared/cors.ts"
---

# Problem Statement

`getCorsHeaders` now treats any HTTPS origin ending in `.vercel.app` as allowed. That logic lives in **shared** CORS used by every edge function that calls `jsonResponse` / `handleOptions`, not only `healthcheck`.

The inline comment claims the exception is for healthcheck (no PHI), but the implementation widens CORS for **all** function responses that use this helper. For HIPAA-style deployments that relied on a tight browser origin allowlist, this increases cross-origin surface: any app deployed under `*.vercel.app` receives `Access-Control-Allow-Origin` for that requesting origin.

## Resolution

Implemented **Option A (env-gated)**: the blanket `https://*.vercel.app` rule runs only when the Edge Function secret **`RELAX_VERCEL_CORS`** is `true`, `1`, or `yes`. Default is **off**. Repo-specific preview regexes and `ALLOWED_ORIGINS` unchanged.

## Findings

- Evidence: `supabase/functions/_shared/cors.ts` lines 77–78: `(/^https:\/\//.test(origin) && /\.vercel\.app$/i.test(origin))`
- Same module is imported across edge functions (shared `jsonResponse`).
- Top-of-file documentation still emphasizes explicit allowlists and HIPAA-oriented origins, which is now partially contradicted by the broad Vercel rule.

## Proposed Solutions

### Option A — Env-gated relaxation (recommended) — **DONE**

### Option B — Healthcheck-only permissive CORS

### Option C — Tight regex + `ALLOWED_ORIGINS` only

## Recommended Action

Set `RELAX_VERCEL_CORS` in Supabase Edge secrets when you need arbitrary Vercel preview hosts; otherwise rely on named regexes + `ALLOWED_ORIGINS`. See `docs/deployment.md` (CORS section).

## Technical Details

- **Files:** `supabase/functions/_shared/cors.ts`, `docs/deployment.md`
- **Deploy:** Redeploy edge functions after setting secrets

## Acceptance Criteria

- [x] Policy choice documented in `docs/deployment.md` or security notes (strict vs relaxed previews).
- [x] Default production behavior matches chosen posture (env or split helper).
- [x] Comment in `cors.ts` accurately describes scope (which functions / env affect it).

## Work Log

- 2026-03-21 — Created from post-merge code review of `163a9f0`.
- 2026-03-21 — Gated broad `.vercel.app` on `RELAX_VERCEL_CORS`; documented in deployment guide.

## Resources

- Commit: `163a9f0` — fix: Backend banner false positives
- Related: `src/lib/edgeHealth.ts` (client probe; no PHI in healthcheck body)
