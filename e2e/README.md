# E2E tests (Playwright)

First-time setup: install Playwright browsers (once per machine):

```bash
npx playwright install
```

Run all E2E tests:

```bash
npm run test:e2e
```

Or with UI: `npm run test:e2e:ui`.

## Login flow (real Supabase)

The **login → dashboard**, **print/export**, **roster sort**, and **Round runner** tests require a real Supabase project and test user. Set:

- `E2E_TEST_EMAIL` – test user email
- `E2E_TEST_PASSWORD` – test user password

Prefer putting them in gitignored `.env.local` (loaded by `playwright.config.ts`). Shell exports still override.

If these are not set, those tests are skipped. The **auth page smoke** test (auth page loads and shows login form) always runs.

Example:

```bash
# one-shot
E2E_TEST_EMAIL=test@example.com E2E_TEST_PASSWORD=secret123 npm run test:e2e

# or after writing .env.local
npm run test:e2e -- --grep "Round runner"
```

Ensure the app is configured with valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`) so auth works.

The Round walk path skips unless that user has **≥3 patients** (RLS-scoped).

## Round runner (Focus-first)

Credential-gated specs live in `e2e/round-runner.e2e.spec.ts`. They assert:

- Tools + roster in primary chrome; demoted utilities only via Tools sheet
- Roster overlay open/close
- next/prev/done walk (≥3 seeded patients) → End Round print
- Import Patient List on Round Home

Component-level coverage (no credentials) lives under `src/components/round/__tests__/`.
