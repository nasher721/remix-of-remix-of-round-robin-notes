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
- Test files: `src/services/__tests__/` (minimal coverage currently)
- Run with: `npm test`

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
