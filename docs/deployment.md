# Deployment — Round Robin Notes

How production and preview environments stay in sync: **Supabase** (DB + edge functions) and **Vercel** (frontend).

## When this workflow runs

| Trigger | What deploys |
|---------|----------------|
| Push to `main` touching `supabase/**` | [Deploy Supabase](../.github/workflows/deploy-supabase.yml): migrations → edge functions → **healthcheck smoke test** → optional Vercel hook |
| Push to `main` (any path) | Vercel Git integration builds the frontend (unless you rely only on the hook below) |

Edge and frontend deploy on **different triggers**. Releases that change **both** need a deliberate order (below).

---

## Recommended order (client + edge changes)

1. **Merge and deploy backend first**  
   Land changes under `supabase/` on `main` so `Deploy Supabase` runs: `db push` + `functions deploy` + smoke test.

2. **Deploy frontend second**  
   - Either let Vercel build from the same merge (if `src/` and `supabase/` ship together in one commit, both may run in parallel — risky), **or**  
   - Split commits: first `supabase/**` only (backend deploy), then app code; **or**  
   - Set `VERCEL_DEPLOY_HOOK_URL` so the workflow triggers a production build **after** edge deploy succeeds.

3. **Exception — frontend-only**  
   If the edge API shape and secrets are unchanged, a normal Vercel deploy is enough.

4. **Exception — breaking edge API**  
   If the app must call a new function or body shape, **never** ship the frontend before the matching functions are live.

---

## GitHub Actions secrets

Configure in **Repository → Settings → Secrets and variables → Actions**.

### Required for healthcheck (do this first)

1. **Create** `SUPABASE_ANON_KEY`  
   - Value = **exactly** the same string as **`VITE_SUPABASE_PUBLISHABLE_KEY`** in your Vercel env (or in local `.env`).  
   - Source: Supabase Dashboard → **Project Settings → API** → **anon** / **public** key (`eyJ...`).  
2. If this secret is missing, the **Deploy Supabase** workflow **fails** on the smoke-test step with a clear error pointing here.

| Secret | Used by | Purpose |
|--------|---------|---------|
| `SUPABASE_ACCESS_TOKEN` | Deploy Supabase | Supabase CLI auth |
| `SUPABASE_PROJECT_ID` | Deploy Supabase | Project ref (same as `project_id` in `supabase/config.toml`) |
| `SUPABASE_ANON_KEY` | Deploy Supabase | Post-deploy `healthcheck` smoke test (`Authorization` + `apikey`) — **required** |
| `VERCEL_DEPLOY_HOOK_URL` | Deploy Supabase (optional) | `POST` after successful deploy to trigger a Vercel production build |

The anon key is the same **public** key as `VITE_SUPABASE_PUBLISHABLE_KEY` / dashboard **Project API → anon public**.

---

## CORS and new frontend URLs

Edge functions use an origin allowlist: [`supabase/functions/_shared/cors.ts`](../supabase/functions/_shared/cors.ts).

- **Defaults** include localhost ports and the main Vercel production hostname. Regex allows common **Vercel preview** URL patterns.
- **Custom domain** (e.g. `https://app.hospital.org`): add it to Supabase **Edge Function secrets** as `ALLOWED_ORIGINS` (comma-separated). Values are **merged** with code defaults, so you usually only append new origins.
- After changing `ALLOWED_ORIGINS`, redeploy functions (or merge a `supabase/` change) so workers pick up secrets.

If the browser shows CORS errors right after a new URL goes live, check allowlist + preview regex before debugging app code.

---

## Smoke test (healthcheck)

After `supabase functions deploy`, CI calls:

`GET https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/healthcheck`

with anon key headers. **200** and healthy body = pass; **non-200** fails the workflow.

[`healthcheck`](../supabase/functions/healthcheck/index.ts) pings the database (`user_settings`). `verify_jwt = false` in [`config.toml`](../supabase/config.toml) so CI can call it without a user session.

Local manual check:

```bash
export SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export ANON_KEY="your-anon-key"
curl -sS "$SUPABASE_URL/functions/v1/healthcheck" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "apikey: $ANON_KEY"
```

---

## Optional: Vercel deploy hook

1. Vercel → Project → **Settings → Git → Deploy Hooks** → create hook for **Production**.
2. Add the URL to `VERCEL_DEPLOY_HOOK_URL`.

If unset, the workflow skips the step; frontend still deploys via the normal Git integration when you push app code.

---

## Observability (Sentry)

Optional client-side error reporting. If `VITE_SENTRY_DSN` is unset, the app does not send events.

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SENTRY_DSN` | Local `.env`, Vercel env (Production + Preview) | Sentry project DSN (public; safe in the bundle). |
| `VITE_APP_VERSION` | Optional | Overrides Sentry **release** string. If omitted, the build uses `package.json` `version`, and on Vercel appends `+` short git SHA (`VERCEL_GIT_COMMIT_SHA`). |

Match **release** in Sentry to uploaded source maps if you use them. See [`src/lib/observability/sentryClient.ts`](../src/lib/observability/sentryClient.ts) (`beforeSend` scrubs query strings and payload-like breadcrumbs).

---

## Related

- Resilience plan: [plans/2026-03-19-edge-functions-resilience-plan.md](plans/2026-03-19-edge-functions-resilience-plan.md)
- Supabase workflow: [.github/workflows/deploy-supabase.yml](../.github/workflows/deploy-supabase.yml)
