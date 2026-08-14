# CLAUDE.md — Round Robin Notes

## Project Overview

**Round Robin Notes** is a clinical documentation and patient rounding application for ICU/hospital workflows. It enables team-based patient management with clinical decision support, real-time collaboration, and comprehensive data export capabilities.

Deployed on Vercel with React, TypeScript, Supabase, and Tailwind CSS.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5.8 |
| Build | Vite 5.4 with SWC (React plugin) |
| Styling | Tailwind CSS 3.4 + shadcn/ui (Radix primitives) |
| State | React Context API (global) + TanStack React Query 5 (server) |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Routing | React Router 6 (SPA, client-side only) |
| Forms | React Hook Form + Zod validation |
| Package Manager | npm (bun.lockb also present) |
| Motion (UI) | Framer Motion (default) + **Anime.js v4** (`animejs`) for timelines / choreography |

## Motion libraries (Framer Motion vs Anime.js)

- **Framer Motion** remains the default for declarative enter/exit, springs, `AnimatePresence`, layout, and gesture-driven UI. Shared variants live in `src/lib/animations.ts`; route transitions use `src/components/ui/page-transition.tsx`.
- **Anime.js v4** is a **complement**: use it for multi-step **timelines**, SVG/path motion, staggered choreography, or one-off hero sequences where imperative control is clearer. Import only what you need from `animejs` (e.g. `createTimeline`, `stagger`).
- **Lifecycle-safe usage**: wrap timelines in **`useAnimeTimeline`** (`src/hooks/useAnimeTimeline.ts`) so unmount calls **`timeline.cancel()`** and optional teardown. Do not scatter raw `animate()` calls without cleanup.
- **Accessibility**: **`prefers-reduced-motion`** must gate motion-heavy work. Use **`useMotionPreference()`** from `src/hooks/useReducedMotion.tsx` (same signal as the rest of the app—OS + `localStorage` override). When reduced motion is preferred, **skip Anime timelines** or jump to the final visual state; **no-op** is handled inside `useAnimeTimeline` when `prefersReducedMotion` is true.
- **Conflicts**: Do not animate the same DOM properties on the same node with both Framer Motion and Anime.js at once.

## Commands

```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build (vite build)
npm run build:dev  # Development build
npm run lint       # ESLint (flat config, TS/TSX files)
npm run preview    # Preview production build
npm test           # Node.js native test runner with custom TS loader
```

## Deployment

See **[docs/deployment.md](docs/deployment.md)** for Supabase + Vercel order, CORS/`ALLOWED_ORIGINS`, GitHub Actions secrets, and post-deploy healthcheck.

## Project Structure

```
src/
├── components/          # React components (625+ files)
│   ├── ui/              # shadcn/ui base components (do not edit directly)
│   ├── dashboard/       # Desktop & mobile dashboard views
│   ├── mobile/          # Mobile-specific components
│   ├── labs/            # Lab trending visualizations
│   ├── ibcc/            # IBCC clinical reference UI
│   ├── guidelines/      # Clinical guidelines components
│   ├── phrases/         # Clinical phrases management
│   ├── print/           # Print & export functionality
│   └── features/        # Feature-specific components
├── hooks/               # Custom React hooks (35+)
│   ├── usePatients.ts   # Core patient CRUD + React Query
│   ├── useAuth.tsx      # Authentication (exports AuthProvider)
│   └── ...
├── contexts/            # React Context providers
│   ├── SettingsContext.tsx
│   ├── IBCCContext.tsx
│   ├── ClinicalGuidelinesContext.tsx
│   ├── ChangeTrackingContext.tsx
│   ├── DashboardContext.tsx
│   └── DashboardTodosContext.tsx
├── pages/               # Route pages
│   ├── Index.tsx         # Main dashboard (responsive desktop/mobile)
│   ├── Auth.tsx          # Login/signup
│   ├── PrintExportTest.tsx  # Dev-only test page
│   └── NotFound.tsx
├── types/               # TypeScript type definitions (21 files)
├── services/            # Business logic services
│   └── patientService.ts
├── api/                 # API client with retry/dedup
├── integrations/
│   └── supabase/        # Supabase client config + generated types
├── lib/                 # Utility libraries
│   ├── cache/           # Caching utilities
│   ├── offline/         # Offline/PWA functionality
│   ├── observability/   # Logging & metrics
│   ├── mappers/         # Data transformation
│   └── print/           # Print utilities
├── utils/               # Helper utilities
├── constants/           # Configuration constants
├── data/                # Static data (IBCC content, guidelines, autotexts)
├── App.tsx              # Root component (provider hierarchy)
├── main.tsx             # Entry point
└── index.css            # Global styles + Tailwind directives

supabase/
├── functions/           # Edge Functions (serverless)
│   ├── ai-clinical-assistant/
│   ├── format-medications/
│   ├── generate-daily-summary/
│   ├── generate-interval-events/
│   ├── generate-patient-course/
│   ├── generate-todos/
│   ├── parse-handoff/
│   ├── parse-single-patient/
│   ├── transcribe-audio/
│   └── transform-text/
├── migrations/          # Database migration files
└── config.toml          # Supabase project config
```

## Architecture

### Provider Hierarchy (App.tsx)

```
GlobalErrorBoundary
  └── QueryClientProvider (createOptimizedQueryClient)
        └── ThemeProvider
              └── AuthProvider
                    └── SettingsProvider
                          └── IBCCProvider
                                └── ClinicalGuidelinesProvider
                                      └── TooltipProvider
                                            └── BrowserRouter (Routes)
```

Route-scoped: `ChangeTrackingProvider` and `DashboardProvider` wrap only the Index route (`/`), not `/auth` or `/fhir/callback`.

### Data Flow

1. **Components** call **custom hooks** (e.g., `usePatients`)
2. Hooks use **React Query** (where adopted) or **useState + Supabase** for server state
3. **Context providers** manage global app state (auth, settings, IBCC, guidelines)
4. **Supabase Edge Functions** handle AI/server-side operations
5. Optimistic updates provide responsive UX

## Critical User Flows

### 1. Authentication & Entry

- **Route**: `/auth` → `[src/pages/Auth.tsx](src/pages/Auth.tsx)`
- **Purpose**: Email/password + OAuth login and signup, then redirect to the main dashboard.
- **Key hooks & components**:
  - `useAuth` (`src/hooks/useAuth.tsx`) for `signIn`, `signUp`, and current `user`.
  - `useToast` for error/success feedback to the user.
  - shadcn `Button`, `Input`, and `Label` from `src/components/ui/` for form UI.
- **Flow**:
  1. User lands on `/auth`.
  2. Submits credentials (or uses Google/Apple OAuth).
  3. On success, navigates to `/` where the main dashboard is rendered.

### 2. Patient Dashboard & Rounding

- **Route**: `/` → `[src/pages/Index.tsx](src/pages/Index.tsx)`
- **Purpose**: Central workspace for rounding—patient list, filtering/sorting, note entry, analytics, and tools.
- **Entry components & contexts**:
  - `Index` wraps `IndexContent` in `ChangeTrackingProvider`.
  - `IndexContent` chooses `DesktopDashboard` vs `MobileDashboard` based on `useIsMobile`.
  - `DashboardProvider` (`src/contexts/DashboardContext.tsx`) supplies shared dashboard state/actions.
- **Key hooks**:
  - `usePatients` (`src/hooks/usePatients.ts` → `src/hooks/patients/index.ts`) for loading patients and CRUD:
    - `patients`, `loading`, `addPatient`, `addPatientWithData`, `updatePatient`, `removePatient`, `duplicatePatient`,
      `toggleCollapse`, `collapseAll`, `clearAll`, `importPatients`, `refetch`.
  - `useAllPatientTodos` for per-patient todos (printed and summarized in dashboards).
  - `usePatientFilter` for search/filtering/sorting logic.
  - `useSettings` for user preferences (e.g. `sortBy`, font size).
  - `useIBCCState` for context-aware clinical guidance tied to current patient.
- **Desktop dashboard** (`src/components/dashboard/DesktopDashboard.tsx`):
  - Header: app chrome, patient count, presence, theme toggle, sign-out.
  - Utility bar: resources (IBCC, guidelines), tools (imports, AI, analytics), settings (display, workflow, authoring).
  - Main workspace:
    - Search/filter/sort controls.
    - Summary badges (filtered vs total patients, sync status).
    - `VirtualizedPatientList` for patient cards (non-virtualized on purpose for rich content).
    - `PatientNavigator` sticky quick-jump panel on the right.
  - Overlays/modals: `PrintExportModal`, `MultiPatientComparison`, `PhraseManager`, `AICommandPalette`, destructive action dialogs.
- **Mobile dashboard** (`src/components/dashboard/MobileDashboard.tsx`):
  - `MobileHeader` + `MobileNavBar` for tabbed navigation (`patients`, `add`, `reference`, `settings`).
  - `VirtualizedMobilePatientList` for list view; `MobilePatientDetail` for focused editing per patient.
  - Mobile panels: `MobileAddPanel`, `MobileReferencePanel`, `MobileSettingsPanel`, `MobileBatchCourseGenerator`.

### 3. Patient Detail & Note Editing

- **Surfaces**:
  - **Desktop**: `PatientCard` and related systems/notes components within `VirtualizedPatientList` (`src/components/dashboard/VirtualizedPatientList.tsx` and `src/components/PatientCard.tsx`).
  - **Mobile**: `MobilePatientDetail` (`src/components/mobile/MobilePatientDetail.tsx`).
- **Data & mutations**:
  - All field edits funnel through `usePatients().updatePatient(id, field, value)`, which is implemented via:
    - `usePatientMutations` (`src/hooks/patients/usePatientMutations.ts`) and
    - `patientService` / mappers (`src/services/patientService.ts`, `src/lib/mappers/patientMapper.ts`).
  - Systems and medications are structured using `PatientSystems` / `PatientMedications` and helpers in `patientService`.
- **Supporting contexts**:
  - `ChangeTrackingContext` to record field-level timestamps and visualize recent changes.
  - `SettingsContext` for font size, layout, and visibility settings.
  - `DashboardContext` for patient selection and shared actions (duplicate, remove, collapse, etc.).

### 4. FHIR / EHR Import

- **Route**: `/fhir/callback` → `[src/pages/FHIRCallback.tsx](src/pages/FHIRCallback.tsx)`
- **Purpose**: Handle SMART-on-FHIR callback, pull patient demographics/medications, and create a new patient in the app.
- **Key pieces**:
  - `handleCallback`, `fetchPatientData` from `src/integrations/fhir`.
  - `usePatients().addPatientWithData` to create a patient based on FHIR data.
- **Flow**:
  1. User completes EHR launch and is redirected to `/fhir/callback`.
  2. `handleCallback` initializes the FHIR client.
  3. `fetchPatientData` grabs patient and medications.
  4. A synthesized `patientData` object is built and passed to `addPatientWithData`.
  5. On success, the app redirects back to `/` with the new patient available in the dashboard.

### 5. Print & Export

- **Surface**:
  - In-app modal: `PrintExportModal` (`src/components/PrintExportModal.tsx`) from desktop and mobile dashboards.
  - Dev harness: `/__print-export-test` → `[src/pages/PrintExportTest.tsx](src/pages/PrintExportTest.tsx)` in dev only.
- **Core components & types**:
  - `PrintDocument` (`src/components/print/PrintDocument.tsx`) renders printable layouts.
  - `PrintSettings` (`src/lib/print/types.ts`) and defaults/utilities in `src/components/print/constants.ts`.
- **Flow**:
  1. User opens Print/Export from dashboard.
  2. `PrintExportModal` composes `patients`, per-patient todos (`useAllPatientTodos` map), and user-selected `PrintSettings`.
  3. `PrintDocument` renders the final preview/print layout.
  4. `PrintExportTest` exercises edge-case layouts (wide tables, long notes, large images) and exposes `window.runPrintExportTest` for automated visual regression/overflow checks.

### React Query Defaults

- `staleTime`: 60s
- `gcTime`: 5 min
- `retry`: 2 (queries), 1 (mutations)
- `refetchOnWindowFocus`: false
- `refetchOnMount`: false

### Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Index | Main dashboard |
| `/auth` | Auth | Authentication page |
| `/__print-export-test` | PrintExportTest | Dev-only test page |
| `*` | NotFound | 404 fallback |

## Key Conventions

### Import Aliases

Use `@/` to import from `src/`. Configured in both `tsconfig.json` and `vite.config.ts`.

```typescript
import { Button } from "@/components/ui/button";
import { usePatients } from "@/hooks/usePatients";
```

### TypeScript Configuration

- **Loose typing**: `noImplicitAny: false`, `strictNullChecks: false`
- `allowJs: true`, `skipLibCheck: true`
- These settings mean `null`/`undefined` checks are not enforced by the compiler. Be cautious with nullable values.

### ESLint Rules

- React Hooks rules enforced
- `react-refresh/only-export-components`: warn (allows constant exports)
- `@typescript-eslint/no-unused-vars`: **off** (unused vars are allowed)
- Config: flat ESLint 9 format in `eslint.config.js`

### Component Patterns

- **shadcn/ui components** live in `src/components/ui/` — these are copied into the project and can be customized, but prefer extending over modifying base components
- **Feature components** are organized by domain (dashboard, mobile, labs, etc.)
- **Mobile-specific** components exist alongside desktop counterparts
- **Responsive rendering**: Index page renders different dashboard based on viewport

### Styling

- Tailwind CSS with `tailwind-merge` and `clsx` via the `cn()` utility in `src/lib/utils.ts`
- Custom animations defined in `tailwind.config.ts`: accordion, fade, scale, shake, glow-pulse
- Tailwind Typography plugin for rich text rendering

### State Management

- **Server state**: React Query (patient data, todos, phrases, etc.)
- **Global app state**: React Context (auth, settings, IBCC, clinical guidelines, change tracking)
- **Local state**: Component-level `useState`/`useReducer`
- **Persistence**: LocalStorage for user preferences

### Supabase

- Client configured in `src/integrations/supabase/`
- Auto-generated types in `src/integrations/supabase/types.ts`
- Environment variables prefixed with `VITE_SUPABASE_*` (in `.env`)
- Optional: `VITE_SENTRY_DSN` (errors); release is `VITE_APP_VERSION` or auto from `package.json` / Vercel SHA — see [docs/deployment.md](docs/deployment.md#observability-sentry)
- Edge Functions in `supabase/functions/` use Deno runtime

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `patients` | Core patient records (systems, meds, labs, imaging) |
| `patient_todos` | Per-patient task management |
| `patient_field_history` | Audit trail of field changes |
| `autotexts` | Quick text expansion shortcuts |
| `clinical_phrases` | Reusable clinical text blocks |
| `phrase_folders` | Phrase organization |
| `phrase_teams` / `phrase_team_members` | Team collaboration for phrases |
| `phrase_usage_log` | Phrase analytics |
| `phrase_versions` | Version history |
| `learned_phrases` | AI-learned patterns |
| `templates` | Reusable note templates |
| `user_dictionary` | Custom spell corrections |
| `user_settings` | Per-user preferences |

## Testing

- Uses Node.js native test runner with a custom TypeScript loader (`scripts/ts-loader.mjs`)
- Test files are colocated across `src/**/*.test.ts(x)`; Playwright release scenarios live in `e2e/`
- Run with: `npm test`

## Release Hardening Playbooks

### Exact-revision clinical deployments

**Context**: Frontend, database, Edge functions, monitoring, and PHI-capable AI policy must ship as one evidence-backed production release.

**Pattern**:

- If no clinical LLM provider/model has documented approval, deploy with both `CLINICAL_PHI_LLM_PROVIDER=disabled` and `CLINICAL_PHI_LLM_MODEL=disabled`; keep import AI fail-closed instead of inferring a vendor from available API keys.
- Require the exact `main` SHA to pass unit, security, migration, build, Edge, Clinical MCP, and zero-skipped authenticated Chromium/WebKit gates before production mutation.
- Revalidate `main` before and after backend deployment, then require the Vercel hook and poll the canonical origin until `app-version` contains the exact short SHA plus the expected canonical origin, session policy, and public `llms.txt` index.
- Finish with live public Chromium/WebKit checks and the production monitor's protected health, telemetry-ingest, and reversible authenticated-save canary.

**Avoid**: Inventing clinical-provider values, bypassing a failing browser gate, treating a pending Vercel hook as success, or deploying frontend/backend revisions independently.

**Confidence**: High — exact-SHA CI, Supabase, Vercel, live browser, and production-monitor evidence for `988114e`, 2026-08-13.

### Roster intake while clinical AI is disabled

**Context**: Production may intentionally keep PHI-capable clinical AI disabled until a provider and model have documented approval, but clinicians still need a usable first-run roster intake path.

**Pattern**: Keep client-side CSV/spreadsheet mapping as the default **Import Patient List** tab and route only document/image extraction through the deployment-approved clinical AI path. Reuse `organizeCsvImportRecord` and the same patient-import callback so both paths preserve one downstream roster contract. Verify the default and AI tabs at a 390px viewport in authenticated Chromium and WebKit.

**Avoid**: Enabling a temporary provider, inferring approval from an available API key, or making the primary import action depend exclusively on AI; each either weakens the PHI policy or leaves a production user unable to create a roster.

**Confidence**: High — 637/637 app tests, 31/31 authenticated Chromium, 31/31 authenticated WebKit, 18/18 live public checks, and the post-deploy save canary for `988114e`, 2026-08-13.

### Atomic cleanup in serial release E2E

**Context**: Credentialed Playwright scenarios share one synthetic Supabase fixture and run serially; one flaky cleanup can cause later safety scenarios to be recorded as skipped even if the failed scenario passes on retry.

**Pattern**: Restore multi-mutation editor fixtures with one real keyboard replacement and one revision-guarded save. Keep `E2E_REQUIRE_FULL_SUITE=1`, deterministic setup/teardown, and the no-skipped reporter enabled for release evidence.

**Avoid**: Sequential debounced cleanup saves for multiple markers or relying on retries to legitimize a release run with skipped downstream tests.

**Confidence**: High — reproduced marker reintroduction, replaced cleanup atomically, and verified all four data-integrity scenarios plus 31/31 Chromium and 31/31 WebKit, 2026-08-13.

### Prelaunch public configuration contracts

**Context**: Contact and privacy details may be intentionally absent during a prelaunch deployment, but production must never invent placeholder operator details.

**Pattern**: Treat configured launch state and explicit unconfigured prelaunch state as separate valid contracts. Hide contact actions and omit privacy crawl links when values are absent, render an honest prelaunch notice, and make production-preview E2E validate both branches. Before market launch, provision and verify the approved contact email and privacy-notice URL.

**Avoid**: Hard-coding fallback addresses/URLs or writing browser tests that always require launch-only metadata; both either publish false information or block an intentional prelaunch build.

**Confidence**: High — production-preview Chromium failure and corrected dual-state browser coverage, 2026-08-13.

### Theme startup without first-paint flash

**Context**: Saved/system theme must be correct before React mounts, including hardened browsers where Web Storage throws.

**Pattern**:

- Keep `public/theme-init.js` parser-blocking and self-hosted after the default `theme-color` meta; inline bootstrap code violates the production CSP.
- Accept only `light`, `dark`, or `system`, catch storage failures, and apply the resolved root class, `color-scheme`, high-contrast class, and fixed theme-color token before first paint.
- Keep bootstrap tokens synchronized with `ThemeProvider`, `manifest.webmanifest`, and service-worker precaching. Verify the first animation frame—not only the final DOM—in production-preview Chromium and WebKit.

**Avoid**: Applying initial theme only in a React passive effect; it produces a visible incorrect frame.

**Confidence**: High — browser timing probes and cross-engine first-frame tests, 2026-08-13.

### Safe retained-chunk recovery across deployments

**Context**: An open tab may request an old hashed lazy chunk after a deploy, during an outage, or after a Vercel SPA rewrite returns `index.html` with HTTP 200.

**Pattern**:

- Apply retained fallback only to same-origin `/assets/*.(js|mjs|css)` requests after cross-origin, authenticated, Supabase, and sensitive-request exclusions.
- Validate JavaScript/CSS MIME types before caching or serving; status alone is insufficient because missing assets can resolve to `200 text/html`.
- Search retained dynamic generations by exact request URL and bounded TTL on non-OK responses, invalid MIME, and rejected network fetches. Keep HTML navigation fallback separate and authoritative 4xx responses visible.
- Exercise real worker A→B→C activation in Chromium and WebKit, including 404, HTML rewrite, rejected-network, unrelated-URL, and expiry cases.

**Avoid**: Unconditional `skipWaiting`, deleting all prior dynamic generations, or treating any successful response as executable code.

**Confidence**: High — VM policy harness plus real cross-browser service-worker lifecycle, 2026-08-13.

### Deliberate PWA activation during clinical work

**Context**: Updating one tab claims sibling tabs that may still be running old code and editing notes.

**Pattern**: Keep new workers waiting until explicit **Refresh now**, require both `controllerchange` and the fixed `WORKER_ACTIVATED` message before reload, and allow **Later** to preserve the incumbent session. Retain every fresh dynamic generation needed by suspended sibling tabs within the recovery TTL.

**Avoid**: Reloading on install or reporting success before activation cleanup and controller handoff finish.

**Confidence**: High — prompt contracts, multi-generation cache tests, and cross-browser upgrade harness, 2026-08-13.

### Offline truth must reach completion and export

**Context**: Round Focus, End Round, print/export, and cold reload must agree while server reads fail or queued mutations remain pending.

**Pattern**: Build shared roster/Todo reads from owner-scoped durable snapshots overlaid with pending IndexedDB mutations. On backend errors—even when `navigator.onLine` is true—show stale local truth for recovery/export, mark it unverified, retry verification, and block irreversible Round completion until the server is authoritative. Treat a snapshot writer returning `false` as an explicit durability failure: keep remote data visible but mark recovery unverified instead of claiming a local snapshot exists.

**Avoid**: Applying queue overlays only inside the focused-patient hook, returning an empty map after a failed server read, or ignoring a failed snapshot write; each can silently omit clinical work after reload or from End Round/export.

**Confidence**: High — cold-reload, transient-failure, completion-guard, and export regression coverage, 2026-08-13.

### Recovery-first deletion of queued clinical work

**Context**: Pending offline mutations may contain the only copy of bedside clinical changes, so clearing the queue is an irreversible PHI-bearing action.

**Pattern**: Expose one shared Offline indicator at every dashboard breakpoint. Before enabling discard, require an explicit local download of the exact current queue; include a format marker, timestamp, PHI warning, mutation/patient identifiers, and payload. Derive confirmation state from the complete queued content, broadcast queue changes across tabs without payloads, and atomically re-check the downloaded signature in the same owner-scoped transaction that deletes mutations. Any concurrent queue change must abort deletion and require a fresh recovery copy. Treat the JSON as an authorized support/manual-recovery artifact, not an automatic import format.

**Avoid**: One-click queue clearing, check-then-delete logic based only on React state, hiding recovery controls at desktop widths, claiming automatic re-import, or leaving discard enabled after the queued payload changes.

**Confidence**: High — source contracts plus authenticated Chromium/WebKit offline edit, recovery-download inspection, cancel-preservation, reload, and exact-once reconnect coverage, 2026-08-13.

### Patient-list import idempotency

**Context**: A bulk insert may commit server-side while its response is lost, making a clinician retry ambiguous.

**Pattern**: Atomically persist a PHI-free owner-plus-roster-fingerprint attempt record with stable client patient IDs in IndexedDB before sending. Hold the owner-transition barrier through write/reconciliation, reconcile only owner-filtered IDs, retain retry identities across normal owner transitions, and delete them only during full local-data clear.

**Avoid**: Patient-number-only retry logic, per-tab/localStorage records, silent age/count eviction, or clearing pending attempt IDs on sign-out; each can duplicate a committed roster.

**Confidence**: High — commit-then-timeout, concurrent acquisition, owner-transition, and durable-storage tests, 2026-08-13.

## Key Features (for context)

- **Patient rounding**: 10-system review (neuro, CV, resp, renal/GU, GI, endo, heme, infectious, skin/lines, dispo)
- **Medication management**: Infusions, scheduled, PRN categories
- **Clinical phrases**: Reusable text blocks with team sharing and versioning
- **AI integration**: Clinical assistant, text transformation, medication formatting, dictation/transcription
- **Export**: PDF (jsPDF), Excel (XLSX), HTML-to-PDF (html2pdf.js), Word parsing (Mammoth)
- **Offline support**: Service worker, offline mutation queue
- **Drag and drop**: Patient reordering via @dnd-kit
- **Lab trending**: Recharts-based visualizations
- **Change tracking**: Field-level timestamps for collaborative editing audit trail

## Common Gotchas

- The TypeScript config is permissive — `null` and `undefined` flow freely. Always guard against nullable values at runtime.
- `@typescript-eslint/no-unused-vars` is disabled, so dead code won't trigger lint warnings.
- The `ui/` components are shadcn copies — check `components.json` for the shadcn configuration before adding new UI primitives.
- Supabase types are auto-generated. If you modify the database schema, regenerate types.
- The dev server runs on port **8080**, not the typical 5173.
