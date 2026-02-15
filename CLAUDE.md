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

## Commands

```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build (vite build)
npm run build:dev  # Development build
npm run lint       # ESLint (flat config, TS/TSX files)
npm run preview    # Preview production build
npm test           # Node.js native test runner with custom TS loader
```

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
│   └── DashboardContext.tsx
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
QueryClientProvider
  └── AuthProvider
        └── SettingsProvider
              └── IBCCProvider
                    └── ClinicalGuidelinesProvider
                          └── TooltipProvider
                                └── BrowserRouter (Routes)
```

### Data Flow

1. **Components** call **custom hooks** (e.g., `usePatients`)
2. Hooks use **React Query** for server state (Supabase queries)
3. **Context providers** manage global app state (auth, settings, IBCC, guidelines)
4. **Supabase Edge Functions** handle AI/server-side operations
5. Optimistic updates provide responsive UX

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
