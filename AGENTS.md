# Round Robin Notes — Agent Guide

## Project Overview

**Round Robin Notes** is a clinical documentation and patient rounding application designed for ICU/hospital workflows. It enables healthcare teams to manage patients through a 10-system review approach, with real-time collaboration, clinical decision support, and comprehensive data export capabilities.

**Deployed on:** Vercel  
**Primary Language:** TypeScript (React)  
**Architecture:** SPA (Single Page Application) with responsive design for desktop, tablet, and mobile

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18.3 + TypeScript 5.8 |
| Build Tool | Vite 5.4 with SWC (React plugin) |
| Styling | Tailwind CSS 3.4 + shadcn/ui (Radix UI primitives) |
| Server State | TanStack React Query 5 |
| Global State | React Context API |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Routing | React Router 6 (client-side) |
| Forms | React Hook Form + Zod validation |
| Animation | Framer Motion |
| Icons | Lucide React |
| Charts | Recharts, @unovis/react |
| Package Manager | npm (bun.lockb also present) |
| Runtime | Node.js 20+ |

---

## Project Structure

```
RRobin/
├── src/                          # Main source code
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui base components (50+ files)
│   │   ├── dashboard/            # Desktop, mobile, tablet dashboard views
│   │   ├── mobile/               # Mobile-specific components
│   │   ├── labs/                 # Lab visualization components
│   │   ├── ibcc/                 # IBCC clinical reference UI
│   │   ├── guidelines/           # Clinical guidelines components
│   │   ├── phrases/              # Clinical phrases management
│   │   ├── print/                # Print & export functionality
│   │   ├── medications/          # Medication management UI
│   │   ├── offline/              # Offline/sync indicators
│   │   └── features/             # Feature-specific components
│   ├── hooks/                    # Custom React hooks (60+)
│   │   ├── useAuth.tsx           # Authentication provider
│   │   ├── usePatients.ts        # Patient CRUD + React Query
│   │   ├── useClinicalPhrases.ts # Phrases management
│   │   └── ...
│   ├── contexts/                 # React Context providers
│   │   ├── SettingsContext.tsx
│   │   ├── IBCCContext.tsx
│   │   ├── ClinicalGuidelinesContext.tsx
│   │   ├── DashboardContext.tsx
│   │   └── offline/
│   ├── pages/                    # Route-level components
│   │   ├── Index.tsx             # Main dashboard (responsive)
│   │   ├── Auth.tsx              # Login/signup
│   │   ├── Landing.tsx           # Marketing landing page
│   │   ├── FHIRCallback.tsx      # FHIR OAuth callback
│   │   ├── Help.tsx              # Help documentation
│   │   └── NotFound.tsx
│   ├── types/                    # TypeScript type definitions (21 files)
│   ├── services/                 # Business logic services
│   │   ├── llm/                  # LLM provider abstractions
│   │   └── patientService.ts
│   ├── api/                      # API client with retry/dedup
│   ├── integrations/
│   │   ├── supabase/             # Supabase client + generated types
│   │   └── fhir/                 # FHIR integration (client, mapper)
│   ├── lib/                      # Utility libraries
│   │   ├── cache/                # Caching utilities
│   │   ├── offline/              # Offline/PWA functionality
│   │   ├── observability/        # Logging & telemetry
│   │   ├── mappers/              # Data transformation
│   │   └── print/                # Print utilities
│   ├── db/                       # Database layer (Dexie, RxDB)
│   ├── workers/                  # Web Workers
│   ├── data/                     # Static data (IBCC content, guidelines)
│   ├── utils/                    # Helper utilities
│   ├── constants/                # Configuration constants
│   ├── App.tsx                   # Root component with providers
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles + Tailwind
├── supabase/
│   ├── functions/                # Edge Functions (Deno runtime)
│   │   ├── _shared/              # Shared utilities (auth, cors, LLM client)
│   │   ├── ai-clinical-assistant/
│   │   ├── format-medications/
│   │   ├── generate-daily-summary/
│   │   ├── generate-interval-events/
│   │   ├── generate-patient-course/
│   │   ├── generate-todos/
│   │   ├── parse-handoff/
│   │   ├── parse-single-patient/
│   │   ├── transcribe-audio/
│   │   └── transform-text/
│   └── migrations/               # Database migration files
├── public/
│   ├── sw.js                     # Service Worker for PWA/offline
│   └── ...                       # Static assets
├── scripts/
│   └── ts-loader.mjs             # Custom TS loader for Node.js tests
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json                 # Project references config
├── tsconfig.app.json             # App TypeScript config
├── eslint.config.js              # ESLint flat config
├── components.json               # shadcn/ui config
└── vercel.json                   # Vercel deployment config
```

---

## Build and Development Commands

```bash
# Development server (runs on port 8080)
npm run dev

# Production build
npm run build

# Development build
npm run build:dev

# Run ESLint
npm run lint

# Preview production build locally
npm run preview

# Run tests (Node.js native test runner with custom TS loader)
npm test
```

---

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Required: Supabase configuration
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_SUPABASE_URL=your_project_url

# LLM Provider API Keys (used by Edge Functions)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
GROK_API_KEY=
GLM_API_KEY=
HUGGINGFACE_API_KEY=

# LLM Routing Configuration
DEFAULT_LLM_PROVIDER=openai
DEFAULT_LLM_MODEL=gpt-4o
FALLBACK_LLM_PROVIDER=gemini
FALLBACK_LLM_MODEL=gemini-2.5-pro
```

---

## Code Style Guidelines

### TypeScript Configuration

The project uses **permissive TypeScript settings**:

- `strict: true` but with `noImplicitAny: false` and `strictNullChecks: false`
- `allowJs: true`, `skipLibCheck: true`
- `noUnusedLocals: false`, `noUnusedParameters: false`

**Important:** Nullable values are not enforced by the compiler. Always guard against `null`/`undefined` at runtime.

### Import Aliases

Use `@/` to import from `src/`:

```typescript
import { Button } from "@/components/ui/button";
import { usePatients } from "@/hooks/usePatients";
```

Configured in both `tsconfig.json` and `vite.config.ts`.

### ESLint Rules

- React Hooks rules enforced
- `react-refresh/only-export-components`: warn (allows constant exports)
- `@typescript-eslint/no-unused-vars`: **OFF** (unused vars are allowed)
- Config: flat ESLint 9 format in `eslint.config.js`

### Component Patterns

- **shadcn/ui components** in `src/components/ui/` — copied into project, can be customized
- **Feature components** organized by domain (dashboard, mobile, labs, etc.)
- **Responsive rendering**: Index page renders different dashboard based on viewport (mobile/tablet/desktop)
- Prefer extending over modifying base UI components

### Styling

- Tailwind CSS with `tailwind-merge` and `clsx` via the `cn()` utility in `src/lib/utils.ts`
- Custom animations in `tailwind.config.ts`: accordion, fade, scale, shake, glow-pulse
- Custom breakpoints: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `max-md`, `tablet`
- Fluid typography and spacing via CSS custom properties
- Medical status colors: `--medical-blue`, `--medical-green`, `--medical-red`, `--medical-orange`

---

## Testing Instructions

The project uses **Node.js native test runner** with a custom TypeScript loader:

```bash
npm test
```

Test configuration:
- Loader: `scripts/ts-loader.mjs` (uses esbuild for TS→JS transformation)
- Supports `@/` path aliases
- Test files: `src/services/__tests__/` (minimal coverage currently)

To add new tests, create files in `src/services/__tests__/` or alongside components with `.test.ts` suffix.

---

## Architecture

### Provider Hierarchy

```
QueryClientProvider
  └── ThemeProvider
        └── AuthProvider
              └── SettingsProvider
                    └── IBCCProvider
                          └── ClinicalGuidelinesProvider
                                └── TooltipProvider
                                      └── BrowserRouter
```

### Data Flow

1. **Components** call **custom hooks** (e.g., `usePatients`)
2. Hooks use **React Query** for server state (Supabase queries)
3. **Context providers** manage global app state (auth, settings, IBCC, guidelines)
4. **Supabase Edge Functions** handle AI/server-side operations
5. Optimistic updates provide responsive UX

### React Query Defaults

```typescript
{
  staleTime: 60 * 1000,        // 1 minute
  gcTime: 5 * 60 * 1000,       // 5 minutes
  retry: 2,                    // queries
  retry: 1,                    // mutations
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: true,
}
```

### Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Index | Main dashboard (responsive) |
| `/auth` | Auth | Authentication page |
| `/fhir/callback` | FHIRCallback | FHIR OAuth callback |
| `/help` | Help | Documentation |
| `/__print-export-test` | PrintExportTest | Dev-only test page |
| `*` | NotFound | 404 fallback |

---

## Key Features

- **Patient Rounding**: 10-system review (neuro, CV, resp, renal/GU, GI, endo, heme, infectious, skin/lines, dispo)
- **Medication Management**: Infusions, scheduled, PRN categories with formatting
- **Clinical Phrases**: Reusable text blocks with team sharing and versioning
- **AI Integration**: Clinical assistant, text transformation, medication formatting, dictation/transcription
- **Export**: PDF (jsPDF), Excel (XLSX), HTML-to-PDF (html2pdf.js), Word parsing (Mammoth)
- **Offline Support**: Service worker with offline mutation queue
- **Drag and Drop**: Patient reordering via @dnd-kit
- **Lab Trending**: Recharts-based visualizations
- **Change Tracking**: Field-level timestamps for collaborative editing audit trail

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `patients` | Core patient records (systems, meds, labs, imaging) |
| `patient_todos` | Per-patient task management |
| `patient_field_history` | Audit trail of field changes |
| `autotexts` | Quick text expansion shortcuts |
| `clinical_phrases` | Reusable clinical text blocks |
| `phrase_folders` | Phrase organization |
| `phrase_teams` / `phrase_team_members` | Team collaboration |
| `phrase_usage_log` | Phrase analytics |
| `phrase_versions` | Version history |
| `learned_phrases` | AI-learned patterns |
| `templates` | Reusable note templates |
| `user_dictionary` | Custom spell corrections |
| `user_settings` | Per-user preferences |

---

## Security Considerations

### Environment Variables
- All Supabase keys prefixed with `VITE_` for client-side access
- LLM API keys are **server-side only** (used in Edge Functions)
- Never commit `.env` file

### Authentication
- Supabase Auth with JWT tokens
- Row Level Security (RLS) policies on all tables
- Auth state managed via `useAuth` hook

### HTTP Headers (Vercel Config)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- Assets cached with `immutable` flag

### Input Validation
- Edge Functions use shared validation in `_shared/input-validation.ts`
- Zod schemas for form validation
- Rate limiting on Edge Functions

### FHIR Integration
- OAuth 2.0 flow for external EHR connections
- Token exchange handled server-side

---

## Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel dashboard
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Deploy

### Supabase Edge Functions

Deploy separately from frontend:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy
```

---

## Offline Support

The application is a PWA with comprehensive offline support:

- **Service Worker** (`public/sw.js`): Multi-tier caching strategy
  - `STATIC_CACHE`: JS/CSS assets (7 days)
  - `API_CACHE`: Supabase REST calls (5 minutes)
  - `IMAGE_CACHE`: Images and storage (24 hours)
  - `DYNAMIC_CACHE`: Other resources (stale-while-revalidate)
- **Offline Mutation Queue**: Mutations queued when offline, replayed when connected
- **Background Sync**: Automatic synchronization when connectivity restored

---

## Common Gotchas

1. **TypeScript is permissive** — `null` and `undefined` flow freely. Always guard against nullable values at runtime.

2. **ESLint unused-vars is disabled** — dead code won't trigger lint warnings. Be vigilant about cleanup.

3. **shadcn/ui components** — Check `components.json` before adding new UI primitives. These are copied into the project and can be customized.

4. **Supabase types are auto-generated** — If you modify the database schema, regenerate types with `supabase gen types`.

5. **Dev server runs on port 8080** — Not the typical Vite 5173 port.

6. **Mobile-first responsive** — Breakpoints use custom values. Test on actual mobile devices.

7. **Edge Functions use Deno** — Not Node.js. Import from `https://` URLs or `_shared/` modules.

---

## External Integrations

### LLM Providers
- OpenAI (GPT-4o, GPT-4o-mini, Whisper)
- Anthropic (Claude Opus 4, Sonnet 4, Haiku)
- Google Gemini (2.5 Pro, Flash)
- xAI Grok (Grok 2, Grok 2 Mini)
- Zhipu GLM (GLM-4, GLM-4 Flash)
- HuggingFace (Llama, Mixtral, etc.)

### FHIR
- SMART on FHIR integration
- Patient data import from EHR systems

---

## Performance Optimizations

- **Code splitting**: Vendor chunks separated in Vite config (react, router, query, ui, charts, date, icons)
- **Lazy loading**: Secondary routes loaded via `React.lazy()`
- **Service Worker**: Aggressive caching with TTL management
- **React Query**: Smart caching with stale-while-revalidate
- **Virtualization**: react-window for long patient lists
- **Font loading**: Google Fonts with `display=swap`

---

## Contributing

This is a private project. All rights reserved.

When making changes:
1. Follow existing code patterns
2. Test on mobile, tablet, and desktop viewports
3. Verify offline functionality if modifying data layer
4. Update types if modifying database schema
5. Run lint before committing
