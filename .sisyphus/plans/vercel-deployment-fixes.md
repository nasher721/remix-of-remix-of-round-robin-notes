# Vercel Deployment & Runtime Fixes

## TL;DR

> **Quick Summary**: Fix 16 identified runtime errors and production causing JS console errors and patient dashboard rendering failures on the Vercel deployment. Issues span Vercel config, null safety gaps, auth race conditions, and silent error swallowing.
> 
> **Deliverables**:
> - Fixed `vercel.json` SPA rewrite (`.html` extension + npm build alignment)
> - Fixed null safety guards across dashboard components
> - Fixed auth race condition in `useAuth.tsx`
> - Fixed `TeamContext` server-only API call
> - Fixed service worker stale chunk handling
> - Fixed silent catch blocks with error logging
> - Fixed duplicate type in Supabase generated types
> - Added error boundaries around lazy routes in `App.tsx`
> - Test infrastructure setup with coverage for critical paths
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 3 → Task 6 → Tasks 7-10 → Task 11 → F1-F4

---

## Context

### Original Request
Fix runtime issues in production Vercel deployment — JS console errors and patient dashboard components not rendering. Errors happen after specific user actions, not on initial load. User wants test infrastructure included.

### Interview Summary
**Key Discussions**:
- Error type: Runtime issues in production (not build failures)
- Symptoms: JS console errors + components not rendering
- Affected area: Patient dashboard (DesktopDashboard, VirtualizedPatientList, PatientCard)
- Trigger: After specific user actions (expand patient, select, filter)
- Test strategy: YES — include test infrastructure and coverage

**Research Findings** (3 parallel investigations):
- **Vercel config**: `vercel.json` rewrite missing `.html`, build command uses pnpm vs npm, service worker caches stale chunks post-deploy
- **Dashboard rendering**: `user.email` without null guard, `filteredPatients[0].id` on empty array, `todosMap[patientId]` without fallback, `patient.codeStatus.toUpperCase()` without optional chaining
- **Supabase + error handling**: `TeamContext` uses `auth.admin.listUsers()` (server-only), auth race condition in `useAuth.tsx`, 87 silent catch blocks, duplicate `mrn` in generated types, no error boundaries around lazy routes

### Self-Identified Gaps (Metis role performed internally)
- **Guardrail**: Do NOT refactor rich text editor innerHTML (separate plan scope)
- **Guardrail**: Do NOT change component architecture or extract new abstractions
- **Guardrail**: All fixes must be minimal — change only what's needed to prevent the crash

---

## Work Objectives

### Core Objective
Fix all identified runtime error sources so the patient dashboard renders reliably in production on Vercel.

### Concrete Deliverables
- `vercel.json` with correct SPA rewrite destination and npm build commands
- Null-safe access patterns across 5+ dashboard files
- Fixed auth state management in `useAuth.tsx`
- Safe TeamContext (no server-only API calls from client)
- Service worker that handles stale chunks post-deploy
- Error boundaries around all lazy route imports in `App.tsx`
- Error logging in previously-silent catch blocks
- Test infrastructure with coverage for critical rendering paths

### Definition of Done
- [ ] `npm run build` succeeds with no errors
- [ ] `npm test` passes (all new + existing tests)
- [ ] Production deployment renders patient dashboard without JS console errors
- [ ] Direct navigation to `/auth` returns the page (not 404)
- [ ] Expanding/collapsing patient cards does not crash the app

### Must Have
- Fix all 4 CRITICAL issues identified in investigation
- Fix all 6 HIGH priority issues
- Fix at least 3 MEDIUM priority issues (silent catches, optional chaining, env var guard)
- Test infrastructure with at least 5 passing tests covering critical rendering paths
- Every fix must be minimal — only add null guards, not refactor surrounding code

### Must NOT Have (Guardrails)
- Do NOT refactor rich text editor innerHTML (ImagePasteEditor, RichTextEditor, PhraseContentEditor) — out of scope
- Do NOT change component architecture or extract new abstractions/hook wrappers
- Do NOT modify shadcn/ui components in `src/components/ui/`
- Do NOT add new npm dependencies beyond test runner
- Do NOT change Tailwind config, theme, or styling
- Do NOT modify Supabase Edge Functions
- Do NOT add Sentry or new observability tooling
- Do NOT touch mobile-specific components unless fixing a shared null-safety issue

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Node.js native test runner)
- **Automated tests**: YES (tests after implementation)
- **Framework**: Node.js native test runner with custom TS loader (`scripts/ts-loader.mjs`)
- **Test location**: `src/services/__tests__/` (existing) + new test files alongside source

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields
- **Library/Module**: Use Bash (node) — Import, call functions, compare output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — config + foundation):
├── Task 1: Fix vercel.json SPA rewrite + build commands [quick]
├── Task 2: Fix null safety in dashboard components [unspecified-high]
├── Task 3: Fix auth race condition in useAuth.tsx [quick]
├── Task 4: Fix TeamContext admin API call [quick]
└── Task 5: Fix service worker stale chunk handling [quick]

Wave 2 (After Wave 1 — error handling + types):
├── Task 6: Add error boundaries around lazy routes in App.tsx [quick]
├── Task 7: Fix silent catch blocks with error logging [unspecified-high]
├── Task 8: Fix duplicate mrn field in Supabase types [quick]
├── Task 9: Fix Supabase client invalid credential fallback [quick]
└── Task 10: Fix edge function auth token caching [quick]

Wave 3 (After Waves 1-2 — test infrastructure):
└── Task 11: Add test infrastructure + coverage for critical rendering paths [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high + playwright)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Task 6 → Task 11 → F1-F4 → user okay
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 5 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | F1 | 1 |
| 2 | — | F1 | 1 |
| 3 | — | F1 | 1 |
| 4 | — | F1 | 1 |
| 5 | — | F1 | 1 |
| 6 | — | F1 | 2 |
| 7 | — | F1 | 2 |
| 8 | — | F1 | 2 |
| 9 | — | F1 | 2 |
| 10 | — | F1 | 2 |
| 11 | 1-10 | F1-F4 | 3 |
| F1-F4 | 11 | user okay | FINAL |

### Agent Dispatch Summary

- **Wave 1**: 5 tasks — T1 `quick`, T2 `unspecified-high`, T3 `quick`, T4 `quick`, T5 `quick`
- **Wave 2**: 5 tasks — T6 `quick`, T7 `unspecified-high`, T8 `quick`, T9 `quick`, T10 `quick`
- **Wave 3**: 1 task — T11 `unspecified-high`
- **FINAL**: 4 tasks — F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

- [ ] 1. Fix vercel.json SPA Rewrite and Build Command

  **What to do**:
  - In `vercel.json` line 45: Change `"destination": "/index"` to `"destination": "/index.html"`
  - In `vercel.json` line 3: Change `"buildCommand": "pnpm run build"` to `"buildCommand": "npm run build"`
  - In `vercel.json` line 6: Change `"installCommand": "corepack enable && pnpm install --frozen-lockfile"` to `"installCommand": "npm install"`
  - In `vercel.json` line 7: Change `"devCommand": "pnpm run dev"` to `"devCommand": "npm run dev"`

  **Must NOT do**:
  - Do NOT change any headers, cleanUrls, or trailingSlash settings
  - Do NOT add new rewrites or redirects

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5)
  - **Blocks**: Tasks 8-10 (build verification)
  - **Blocked By**: None

  **References**:
  - `vercel.json` (full file, 48 lines) — Current config with wrong destination and pnpm commands
  - `package.json` line 11 — Shows `"build": "vite build"` confirming npm is the correct tool
  - Vercel docs on rewrites: `https://vercel.com/docs/projects/configure-your-project` — Confirms destination needs `.html` for SPA

  **Acceptance Criteria**:
  - [ ] `vercel.json` line 45 contains `"destination": "/index.html"`
  - [ ] `vercel.json` line 3 contains `"npm run build"`
  - [ ] `npm run build` succeeds with updated config

  **QA Scenarios**:
  ```
  Scenario: Build succeeds with new config
    Tool: Bash
    Preconditions: vercel.json has been updated
    Steps:
      1. Run `npm run build`
      2. Check exit code is 0
    Expected Result: Build completes successfully, dist/ directory contains index.html
    Failure Indicators: Build fails, non-zero exit code
    Evidence: .sisyphus/evidence/task-1-build-success.txt

  Scenario: SPA rewrite destination is valid
    Tool: Bash
    Preconditions: Build has completed
    Steps:
      1. Run `grep -c '"destination": "/index.html"' vercel.json`
      2. Assert count is 1
    Expected Result: Exactly 1 match found
    Failure Indicators: 0 matches (missing fix) or 2+ matches (duplicate)
    Evidence: .sisyphus/evidence/task-1-rewrite-check.txt
  ```

  **Commit**: YES
  - Message: `fix(vercel): correct SPA rewrite destination and align build to npm`
  - Files: `vercel.json`
  - Pre-commit: `npm run build`

- [ ] 2. Add Null Safety Guards to Dashboard Components

  **What to do**:
  - In `src/pages/Index.tsx` ~line 87: Change `filteredPatients[0].id` to `filteredPatients[0]?.id ?? null`
  - In `src/components/dashboard/DesktopDashboard.tsx` ~lines 485, 510-511: Change `user.email` to `user?.email ?? ""`
  - In `src/components/dashboard/MobileDashboard.tsx` ~line 325: Change `user.email` to `user?.email ?? ""`
  - In `src/components/dashboard/VirtualizedPatientList.tsx` ~line 94: Change `todosMap[selectedPatient.id]` to `todosMap[selectedPatient.id] ?? []`
  - In `src/components/dashboard/MobileDashboard.tsx` ~line 154: Change `todosMap[selectedPatient.id]` to `todosMap[selectedPatient.id] ?? []`
  - In `src/components/PatientCard.tsx` ~line 430: Change `patient.codeStatus.toUpperCase()` to `(patient.codeStatus ?? "").toUpperCase()`
  - In `src/components/PatientCard.tsx` ~line 579: Change `patient.clinicalSummary.length` to `(patient.clinicalSummary ?? "").length`

  **Must NOT do**:
  - Do NOT change any component logic or rendering behavior
  - Do NOT add new components or extract abstractions
  - Do NOT refactor component structure — only add null guards
  - Do NOT touch rich text editor components (ImagePasteEditor, PhraseContentEditor) — separate scope

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4, 5)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/pages/Index.tsx:81-88` — Empty array guard at line 81, but `filteredPatients[0].id` at line 87 can still fail in callback closure
  - `src/components/dashboard/DesktopDashboard.tsx:485,510-511` — Direct `user.email` access where `user` is typed as `{ email?: string } | null`
  - `src/components/dashboard/MobileDashboard.tsx:325,154` — Same pattern as DesktopDashboard
  - `src/components/dashboard/VirtualizedPatientList.tsx:93-95` — `todosMap[selectedPatient.id]` can be undefined if todo fetch hasn't completed
  - `src/components/PatientCard.tsx:430,579,645,770,843` — Multiple optional property accesses without optional chaining
  - `src/types/patient.ts` — Patient type definitions showing which fields are optional

  **Acceptance Criteria**:
  - [ ] No direct property access on nullable objects without optional chaining (`?.`) or nullish coalescing (`??`)
  - [ ] `npm run build` succeeds
  - [ ] Grep for `filteredPatients[0].id` (without `?.`) returns 0 matches

  **QA Scenarios**:
  ```
  Scenario: No unguarded property access remains
    Tool: Bash
    Preconditions: All null guard fixes applied
    Steps:
      1. grep -rn "filteredPatients\[0\]\.id" src/pages/Index.tsx (should return nothing)
      2. grep -rn "user\.email" src/components/dashboard/DesktopDashboard.tsx (should only show user?.email)
      3. grep -rn "todosMap\[selectedPatient\.id\]" src/components/dashboard/ (should show ?? [])
    Expected Result: No unguarded access patterns found
    Failure Indicators: Any grep matches for bare `.id` or `.email` without `?.`
    Evidence: .sisyphus/evidence/task-2-null-guards.txt

  Scenario: Build passes after null guard fixes
    Tool: Bash
    Preconditions: Fixes applied
    Steps:
      1. Run `npm run build`
      2. Check exit code is 0
    Expected Result: Build succeeds with no TypeScript errors
    Failure Indicators: Build fails
    Evidence: .sisyphus/evidence/task-2-build-pass.txt
  ```

  **Commit**: YES
  - Message: `fix(dashboard): add null safety guards to prevent runtime crashes`
  - Files: `src/pages/Index.tsx`, `src/components/dashboard/DesktopDashboard.tsx`, `src/components/dashboard/MobileDashboard.tsx`, `src/components/dashboard/VirtualizedPatientList.tsx`, `src/components/PatientCard.tsx`
  - Pre-commit: `npm run build`

- [ ] 3. Fix Auth Race Condition in useAuth.tsx

  **What to do**:
  - In `src/hooks/useAuth.tsx`: Add a `mounted` ref to prevent duplicate `setLoading(false)` calls
  - The `onAuthStateChange` listener fires immediately with current state, then `initializeSession()` runs async — both call `setLoading(false)`
  - Fix: Add `const initialized = useRef(false)` flag, set it to true after first `setLoading(false)`, skip subsequent calls

  **Must NOT do**:
  - Do NOT change the auth state change handler logic
  - Do NOT modify the session initialization flow
  - Only add the deduplication guard

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4, 5)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/hooks/useAuth.tsx:21-51` — Full auth hook showing `onAuthStateChange` listener and `initializeSession()` function
  - `src/integrations/supabase/client.ts` — Supabase client initialization that auth depends on
  - `src/contexts/SettingsContext.tsx:93-142` — Example of localStorage guard pattern for reference

  **Acceptance Criteria**:
  - [ ] `setLoading(false)` only executes once per mount cycle
  - [ ] `npm run build` succeeds
  - [ ] No auth state change infinite loops possible

  **QA Scenarios**:
  ```
  Scenario: Auth loading state transitions correctly
    Tool: Bash
    Preconditions: useAuth.tsx has been updated
    Steps:
      1. Read useAuth.tsx
      2. Verify there is a guard preventing duplicate setLoading(false)
      3. Run `npm run build`
    Expected Result: Build succeeds, guard exists in code
    Failure Indicators: No guard found, or build fails
    Evidence: .sisyphus/evidence/task-3-auth-race-fix.txt
  ```

  **Commit**: YES
  - Message: `fix(auth): prevent duplicate setLoading calls in auth state handler`
  - Files: `src/hooks/useAuth.tsx`
  - Pre-commit: `npm run build`

- [ ] 4. Fix TeamContext Server-Only API Call

  **What to do**:
  - In `src/contexts/TeamContext.tsx` ~line 130: Replace `supabase.auth.admin.listUsers()` with a safe client-side approach
  - The `admin.listUsers()` requires a Service Role key (not available in browser) and causes a runtime crash
  - Fix options:
    1. If the feature is unused: wrap in try/catch and return empty array on failure
    2. If the feature is needed: move to a Supabase Edge Function and call it via fetch
  - Add error handling with a user-facing toast if the operation fails

  **Must NOT do**:
  - Do NOT remove the team feature entirely — only fix the crash
  - Do NOT create a new Edge Function unless the feature is actively used
  - Do NOT change TeamContext type definitions

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 5)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/contexts/TeamContext.tsx:130` — Line with `supabase.auth.admin.listUsers()` call
  - `src/integrations/supabase/client.ts` — Shows client uses anon key (not service role key)
  - Supabase docs: `https://supabase.com/docs/guides/auth/server-side-rendering` — Confirms admin API requires service_role key

  **Acceptance Criteria**:
  - [ ] No `auth.admin` calls remain in client-side code
  - [ ] `npm run build` succeeds
  - [ ] Team feature either works correctly or gracefully degrades

  **QA Scenarios**:
  ```
  Scenario: No admin API calls in client code
    Tool: Bash
    Preconditions: TeamContext.tsx has been updated
    Steps:
      1. grep -rn "auth\.admin" src/contexts/TeamContext.tsx
      2. Assert 0 matches
    Expected Result: No matches found
    Failure Indicators: Any match found means admin API still in use
    Evidence: .sisyphus/evidence/task-4-no-admin-api.txt

  Scenario: Build passes after TeamContext fix
    Tool: Bash
    Preconditions: Fix applied
    Steps:
      1. Run `npm run build`
      2. Check exit code is 0
    Expected Result: Build succeeds
    Failure Indicators: Build fails
    Evidence: .sisyphus/evidence/task-4-build.txt
  ```

  **Commit**: YES
  - Message: `fix(team): replace server-only admin API call with safe client method`
  - Files: `src/contexts/TeamContext.tsx`
  - Pre-commit: `npm run build`

- [ ] 5. Fix Service Worker Stale Chunk Handling

  **What to do**:
  - In `public/sw.js` ~lines 51-60: In the `activate` event handler, add logic to delete old dynamic caches after claiming new ones
  - Also add logic in the `fetch` handler to detect "Failed to fetch dynamically imported module" errors and force a cache-busted reload
  - The SW already caches JS chunks with `networkFirstWithCache` — when `index.html` points to new hashed chunks after deploy, old cached chunks cause failures
  - Fix: On activate, delete all cached `/assets/*.js` entries older than the current deployment

  **Must NOT do**:
  - Do NOT change the caching strategy entirely (keep network-first for JS)
  - Do NOT remove service worker functionality
  - Do NOT add new caches or change cache names

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 4)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `public/sw.js:51-60` — Activate event handler that currently cleans old caches
  - `public/sw.js:103-106` — Fetch handler for `/assets/*.js` with `networkFirstWithCache`
  - `public/sw.js:93-95` — Comment acknowledging the stale chunk issue after deployments
  - `src/main.tsx` — Service worker registration (production only)

  **Acceptance Criteria**:
  - [ ] Service worker activate handler clears stale JS chunks
  - [ ] Failed dynamic imports trigger a clean reload instead of showing blank page
  - [ ] `npm run build` succeeds

  **QA Scenarios**:
  ```
  Scenario: Stale chunk cleanup logic exists in activate handler
    Tool: Bash
    Preconditions: sw.js has been updated
    Steps:
      1. grep -n "activate" public/sw.js
      2. Read the activate handler section
      3. Verify it deletes old /assets/ entries from dynamic cache
    Expected Result: Activate handler includes stale chunk cleanup
    Failure Indicators: No cleanup logic found
    Evidence: .sisyphus/evidence/task-5-sw-activate.txt

  Scenario: Build passes after SW fix
    Tool: Bash
    Preconditions: Fix applied
    Steps:
      1. Run `npm run build`
      2. Check exit code is 0
    Expected Result: Build succeeds, sw.js copied to dist/
    Failure Indicators: Build fails
    Evidence: .sisyphus/evidence/task-5-build.txt
  ```

  **Commit**: YES
  - Message: `fix(sw): add stale chunk cleanup on service worker activation`
  - Files: `public/sw.js`
  - Pre-commit: `npm run build`

- [ ] 6. Add Error Boundaries Around Lazy Route Imports

  **What to do**:
  - In `src/App.tsx`: Wrap each `React.lazy()` import with a dedicated error boundary component
  - Currently Auth, FHIRCallback, and PrintExportTest are lazy-loaded with only the global error boundary
  - Create a `LazyRouteErrorBoundary` component (or reuse `LazyPanelErrorBoundary` pattern) that catches chunk-load errors and offers a "Retry" button
  - Wrap each lazy route's Suspense with this error boundary

  **Must NOT do**:
  - Do NOT change the lazy loading approach to static imports
  - Do NOT modify the existing `GlobalErrorBoundary` or `LazyPanelErrorBoundary`
  - Do NOT add new dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 8, 9, 10)
  - **Blocks**: Task 11 (test infrastructure)
  - **Blocked By**: Tasks 1-5 (Wave 1)

  **References**:
  - `src/App.tsx:30-32` — Lazy imports for Auth, FHIRCallback, PrintExportTest
  - `src/App.tsx:98-155` — Route definitions with Suspense wrappers
  - `src/components/LazyPanelErrorBoundary.tsx` — Existing error boundary pattern for dynamic imports (reuse this pattern)
  - `src/components/GlobalErrorBoundary.tsx` — Global error boundary (reference for error handling pattern)

  **Acceptance Criteria**:
  - [ ] Each lazy route wrapped in error boundary with retry capability
  - [ ] `npm run build` succeeds
  - [ ] Error boundary catches "Failed to fetch dynamically imported module" errors

  **QA Scenarios**:
  ```
  Scenario: Error boundaries wrap lazy routes
    Tool: Bash
    Preconditions: App.tsx has been updated
    Steps:
      1. Read App.tsx
      2. Find each React.lazy() usage
      3. Verify each is wrapped in an error boundary component
    Expected Result: All 3 lazy routes have error boundary wrappers
    Failure Indicators: Any lazy route without error boundary
    Evidence: .sisyphus/evidence/task-6-error-boundaries.txt

  Scenario: Build passes
    Tool: Bash
    Preconditions: Fix applied
    Steps:
      1. Run `npm run build`
      2. Check exit code is 0
    Expected Result: Build succeeds
    Failure Indicators: Build fails
    Evidence: .sisyphus/evidence/task-6-build.txt
  ```

  **Commit**: YES
  - Message: `fix(routes): add error boundaries around lazy route imports`
  - Files: `src/App.tsx`
  - Pre-commit: `npm run build`

- [ ] 7. Add Error Logging to Silent Catch Blocks

  **What to do**:
  - In `src/lib/lazyData.ts:109-110`: Replace `.catch(() => {})` with `.catch((err) => { console.error('[lazyData] Failed to load:', err) })`
  - In `src/components/UnifiedAIChatbot.tsx:455`: Replace `.catch(() => {})` with `.catch((err) => { console.error('[AI] Clipboard write failed:', err) })`
  - Search for all other `.catch(() => {})` patterns in the codebase and add minimal `console.error` logging
  - Do NOT add telemetry/Sentry calls — just console.error for now (keeping scope small)

  **Must NOT do**:
  - Do NOT add Sentry/telemetry integration (out of scope)
  - Do NOT change error handling behavior (don't throw, don't show toast)
  - Do NOT modify catch blocks that already have meaningful error handling
  - Keep changes minimal — just add logging, don't refactor

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 8, 9, 10)
  - **Blocks**: None
  - **Blocked By**: Tasks 1-5 (Wave 1)

  **References**:
  - `src/lib/lazyData.ts:109-110` — Two `.catch(() => {})` calls for IBCC and guidelines data loading
  - `src/components/UnifiedAIChatbot.tsx:455` — Silent catch on clipboard write
  - Search pattern: `grep -rn "\.catch(() => {})" src/` — Find all 87 instances

  **Acceptance Criteria**:
  - [ ] Zero `.catch(() => {})` patterns remain (all replaced with error logging)
  - [ ] `npm run build` succeeds
  - [ ] All catch blocks that had meaningful handling are untouched

  **QA Scenarios**:
  ```
  Scenario: No silent catch blocks remain
    Tool: Bash
    Preconditions: All fixes applied
    Steps:
      1. grep -rn '\.catch(() => {})' src/ | wc -l
      2. Assert count is 0
    Expected Result: 0 matches found
    Failure Indicators: Any match found means silent catch still exists
    Evidence: .sisyphus/evidence/task-7-no-silent-catch.txt

  Scenario: Build passes after catch block fixes
    Tool: Bash
    Preconditions: Fixes applied
    Steps:
      1. Run `npm run build`
      2. Check exit code is 0
    Expected Result: Build succeeds
    Failure Indicators: Build fails
    Evidence: .sisyphus/evidence/task-7-build.txt
  ```

  **Commit**: YES
  - Message: `fix(errors): add error logging to silent catch blocks`
  - Files: All files with `.catch(() => {})` patterns
  - Pre-commit: `npm run build`

- [ ] 6. Add Error Boundaries Around Lazy Route Imports

  **What to do**:
  - In `src/App.tsx`: Wrap each `React.lazy()` import with a dedicated error boundary
  - Currently: `<Suspense fallback={<LoadingSpinner />}><Auth /></Suspense>`
  - Target: `<Suspense fallback={<LoadingSpinner />}><LazyRouteErrorBoundary><Auth /></LazyRouteErrorBoundary></Suspense>`
  - Create a simple `LazyRouteErrorBoundary` component or use the existing `LazyPanelErrorBoundary`
  - Apply the same pattern to Auth, FHIRCallback, and PrintExportTest routes

  **Must NOT do**:
  - Do NOT change route definitions or add new routes
  - Do NOT modify the existing `Suspense` fallback
  - Do NOT create a new error boundary component if one already exists (`LazyPanelErrorBoundary`)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 8, 9, 10)
  - **Blocks**: None
  - **Blocked By**: Tasks 1-5 (Wave 1)

  **References**:
  - `src/App.tsx:30-32` — Three lazy route imports (Auth, FHIRCallback, PrintExportTest)
  - `src/App.tsx:60-70` — Current Suspense wrapper usage
  - `src/components/LazyPanelErrorBoundary.tsx` — Existing error boundary that could be reused

  **Acceptance Criteria**:
  - [ ] Each lazy route is wrapped in an error boundary
  - [ ] `npm run build` succeeds
  - [ ] Build produces same lazy chunks as before

  **QA Scenarios**:
  ```
  Scenario: Lazy routes have error boundaries
    Tool: Bash
    Preconditions: App.tsx has been updated
    Steps:
      1. grep -n "ErrorBoundary" src/App.tsx | wc -l
      2. Assert at least 3 matches (one per lazy route)
    Expected Result: 3+ matches found
    Failure Indicators: 0 matches means no error boundaries added
    Evidence: .sisyphus/evidence/task-6-lazy-boundaries.txt

  Scenario: Build passes
    Tool: Bash
    Steps:
      1. Run `npm run build`
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-6-build.txt
  ```

  **Commit**: YES
  - Message: `fix(routes): add error boundaries around lazy route imports`
  - Files: `src/App.tsx`
  - Pre-commit: `npm run build`

- [ ] 7. Fix Service Worker Stale Chunk Handling

  **What to do**:
  - In `public/sw.js`: Add stale cache cleanup during the `activate` event
  - In the `activate` handler: Delete old dynamic cache entries that don't match current build's chunk hashes
  - Add a version check: When the new SW activates, clear ALL old dynamic/API caches to force fresh chunk loading
  - This prevents "Failed to fetch dynamically imported module" errors after deployments

  **Must NOT do**:
  - Do NOT change caching strategy (keep network-first for JS chunks)
  - Do NOT change static asset caching
  - Do NOT modify API caching patterns
  - Only modify the `activate` event handler to add stale cache cleanup

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 8, 9, 10)
  - **Blocks**: None
  - **Blocked By**: Tasks 1-5 (Wave 1)

  **References**:
  - `public/sw.js:51-60` — Current `activate` event handler (only cleans old named caches)
  - `public/sw.js:17-18` — Comment on line 17-18 about stale HTML referencing deleted hashed chunks
  - `public/sw.js:103-106` — Network-first caching for JS/CSS assets

  **Acceptance Criteria**:
  - [ ] `activate` handler deletes old dynamic caches before claiming clients
  - [ ] `npm run build` succeeds
  - [ ] Service worker correctly caches new assets after activation

  **QA Scenarios**:
  ```
  Scenario: Activate handler clears old caches
    Tool: Bash
    Preconditions: sw.js has been updated
    Steps:
      1. Read the activate event handler in public/sw.js
      2. Verify it deletes caches named with old versions
    Expected Result: activate handler includes cache cleanup logic
    Failure Indicators: activate handler only does skipWaiting without cleanup
    Evidence: .sisyphus/evidence/task-7-sw-activate.txt

  Scenario: Build passes
    Tool: Bash
    Steps:
      1. Run `npm run build`
    Expected Result: Build succeeds,    Evidence: .sisyphus/evidence/task-7-build.txt
  ```

  **Commit**: YES
  - Message: `fix(sw): clear stale dynamic caches on service worker activation`
  - Files: `public/sw.js`
  - Pre-commit: `npm run build`

- [ ] 8. Fix Duplicate MRN Field in Supabase Generated Types

  **What to do**:
  - In `src/integrations/supabase/types.ts` ~lines 221-234: Remove the duplicate `mrn` field in the patients table schema
  - Keep the first `mrn: string` definition,  - Remove the second duplicate `mrn: string` line
  - Verify the fix doesn't break any consumers of the type

  **Must NOT do**:
  - Do NOT regenerate the entire types file (manual fix only)
  - Do NOT change any other type definitions
  - Do NOT add new types

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 9, 10)
  - **Blocks**: None
  - **Blocked By**: Tasks 1-5 (Wave 1)

  **References**:
  - `src/integrations/supabase/types.ts:221-234` — Contains duplicate `mrn` field at lines 231 and 233
  - `src/types/patient.ts` — Patient type that may reference `mrn`

  **Acceptance Criteria**:
  - [ ] Only one `mrn` field in the patients Row type
  - [ ] `npm run build` succeeds
  - [ ] No TypeScript errors

  **QA Scenarios**:
  ```
  Scenario: No duplicate mrn fields
    Tool: Bash
    Steps:
      1. grep -c "mrn:" src/integrations/supabase/types.ts
      2. Count should be exactly 1 (in the patients table definition)
    Expected Result: Exactly 1 occurrence of "mrn:" in the patients Row type
    Failure Indicators: 0 or 2+ occurrences
    Evidence: .sisyphus/evidence/task-8-mrn-duplicate.txt
  ```

  **Commit**: YES
  - Message: `fix(types): remove duplicate mrn field in Supabase generated types`
  - Files: `src/integrations/supabase/types.ts`
  - Pre-commit: `npm run build`

- [ ] 9. Add Runtime Guard for Invalid Supabase Credentials

  **What to do**:
  - In `src/integrations/supabase/client.ts`: Add a runtime guard that logs a clear warning when env vars are missing
  - The current code silently falls back to `http://localhost` with `invalid-key` — this should at minimum log a prominent console warning
  - Add a `console.warn` that fires once at module load time if `hasSupabaseConfig` is false

  **Must NOT do**:
  - Do NOT throw or crash the app when credentials are missing
  - Do NOT change the fallback behavior (keep localhost + invalid-key)
  - Do NOT add a check that blocks rendering

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 10)
  - **Blocks**: None
  - **Blocked By**: Tasks 1-5 (Wave 1)

  **References**:
  - `src/integrations/supabase/client.ts:22-25` — Current fallback to localhost with invalid-key
  - `src/integrations/supabase/client.ts:1-10` — Environment variable import and config check

  **Acceptance Criteria**:
  - [ ] `console.warn` added when `hasSupabaseConfig` is false
  - [ ] `npm run build` succeeds

  **QA Scenarios**:
  ```
  Scenario: Warning fires when config missing
    Tool: Bash
    Steps:
      1. grep -n "hasSupabaseConfig" src/integrations/supabase/client.ts
      2. Verify there is a console.warn in the else branch
    Expected Result: console.warn found in the falsy config branch
    Evidence: .sisyphus/evidence/task-9-supabase-guard.txt
  ```

  **Commit**: YES
  - Message: `fix(supabase): add runtime warning when environment credentials are missing`
  - Files: `src/integrations/supabase/client.ts`
  - Pre-commit: `npm run build`

- [ ] 10. Add Session Token Caching for Edge Function Calls

  **What to do**:
  - In `src/lib/edgeFunctionHeaders.ts`: Add a simple in-memory cache for the session token
  - Cache the access token with a 4-minute TTL (session tokens typically last 1 hour)
  - Return cached token if still valid, otherwise fetch new session
  - This reduces latency on every edge function call and reduces auth failure risk

  **Must NOT do**:
  - Do NOT use localStorage for token caching (in-memory only)
  - Do NOT change the error handling behavior
  - Do NOT modify the function signature

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 9)
  - **Blocks**: None
  - **Blocked By**: Tasks 1-5 (Wave 1)

  **References**:
  - `src/lib/edgeFunctionHeaders.ts:18-32` — Current implementation fetching session on every call
  - `src/integrations/supabase/client.ts` — Supabase client used for getSession

  **Acceptance Criteria**:
  - [ ] Session token is cached with TTL
  - [ ] `npm run build` succeeds
  - [ ] No session fetch on every call when token is fresh

  **QA Scenarios**:
  ```
  Scenario: Token caching exists
    Tool: Bash
    Steps:
      1. grep -n "cache" src/lib/edgeFunctionHeaders.ts
      2. Verify caching variables exist
    Expected Result: Caching logic found
    Evidence: .sisyphus/evidence/task-10-token-cache.txt
  ```

  **Commit**: YES
  - Message: `perf(edge): add session token caching for edge function calls`
  - Files: `src/lib/edgeFunctionHeaders.ts`
  - Pre-commit: `npm run build`

- [ ] 11. Add Test Infrastructure and Critical Path Coverage

  **What to do**:
  - Add test file `src/services/__tests__/nullSafety.test.ts` — Tests for null guards added in Tasks 2-4
  - Add test file `src/hooks/__tests__/useAuth.test.ts` — Tests for auth race condition fix
  - Test coverage:
    - `filteredPatients[0]?.id` returns null for empty array
    - `user?.email` returns empty string for null user
    - `todosMap[patientId] ?? []` returns empty array for missing key
    - `patient.codeStatus?.toUpperCase()` returns empty string for undefined
    - Auth `setLoading` is called only once
  - Follow existing test patterns from `src/services/__tests__/patientMapper.test.ts`

  **Must NOT do**:
  - Do NOT set up a new test framework (use existing Node test runner)
  - Do NOT add E2E tests (unit tests only)
  - Do NOT mock Supabase internals beyond what's necessary

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 2, 3, 5 (needs fixes in place to test)

  **References**:
  - `src/services/__tests__/patientMapper.test.ts` — Existing test file showing test patterns and mocking approach
  - `src/services/__tests__/patientService.test.ts` — Another existing test for patterns
  - `scripts/ts-loader.mjs` — Custom TypeScript loader for Node test runner
  - `package.json` — Shows `"test": "node --import tsx --test"` command

  **Acceptance Criteria**:
  - [ ] `src/services/__tests__/nullSafety.test.ts` created with 5+ test cases
  - [ ] `npm test` passes with 0 failures
  - [ ] Tests cover: empty array access, null user, missing todosMap, undefined codeStatus, auth race

  **QA Scenarios**:
  ```
  Scenario: Tests pass
    Tool: Bash
    Steps:
      1. Run `npm test`
      2. Check exit code is 0
    Expected Result: All tests pass
    Failure Indicators: Any test failures
    Evidence: .sisyphus/evidence/task-11-tests-pass.txt
  ```

  **Commit**: YES
  - Message: `test: add null safety and auth race condition test coverage`
  - Files: `src/services/__tests__/nullSafety.test.ts`, `src/hooks/__tests__/useAuth.test.ts`
  - Pre-commit: `npm test`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run build` + `npm run lint`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration. Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `fix(vercel): correct SPA rewrite and build config` — vercel.json
- **Wave 1**: `fix(dashboard): add null safety guards to dashboard components` — DesktopDashboard.tsx, MobileDashboard.tsx, VirtualizedPatientList.tsx, PatientCard.tsx, Index.tsx
- **Wave 1**: `fix(auth): resolve race condition in auth state management` — useAuth.tsx
- **Wave 1**: `fix(team): replace admin API call with safe client-side method` — TeamContext.tsx
- **Wave 1**: `fix(sw): handle stale chunks on service worker activation` — public/sw.js
- **Wave 2**: `fix(routes): add error boundaries around lazy route imports` — App.tsx
- **Wave 2**: `fix(errors): add logging to silent catch blocks` — src/lib/lazyData.ts, src/components/UnifiedAIChatbot.tsx, and other files with `.catch(() => {})`
- **Wave 2**: `fix(types): remove duplicate mrn field in Supabase generated types` — src/integrations/supabase/types.ts
- **Wave 2**: `fix(supabase): add runtime guard for invalid credentials` — src/integrations/supabase/client.ts
- **Wave 2**: `fix(edge): add session token caching for edge function calls` — src/lib/edgeFunctionHeaders.ts
- **Wave 3**: `test: add test infrastructure and critical path coverage` — test files

---

## Success Criteria

### Verification Commands
```bash
npm run build    # Expected: successful build with no errors
npm run lint     # Expected: no new errors introduced
npm test         # Expected: all tests pass (new + existing)
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] `npm run build` succeeds
- [ ] No new lint errors introduced
