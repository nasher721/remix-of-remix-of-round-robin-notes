# Round Robin Notes

A clinical documentation and patient rounding application for ICU/hospital workflows.

## Project Overview

Round Robin Notes enables team-based patient management with clinical decision support, real-time collaboration, and comprehensive data export capabilities.

## Tech Stack

- **Frontend**: React 18 + TypeScript 5.8 + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **State Management**: React Query + React Context
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 22.x (use the version pinned in `.nvmrc`)
- npm 10.x (the version family pinned in `package.json`)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start the development server
npm run dev
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_PUBLIC_APP_URL=https://rounds.hospital.org
# Required before market launch; may be omitted for an explicit prelaunch deployment.
# VITE_CONTACT_EMAIL=rounds-team@hospital.org
# VITE_PRIVACY_NOTICE_URL=https://privacy.hospital.org/rolling-rounds
# Production also requires one approved central sink; see .env.example.
# VITE_SENTRY_DSN=https://publickey@o123.ingest.sentry.io/456
```

Production builds fail closed when core runtime or observability configuration
is missing or unsafe. Prelaunch builds may omit contact and privacy publication
values; the UI then hides contact CTAs and labels the privacy page as unapproved.
See [`.env.example`](.env.example) and the
[deployment guide](docs/deployment.md) for the complete contract.

## Available Scripts

```sh
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # Run ESLint
npm run preview    # Preview production build
npm test           # Unit/integration tests (Node test runner)
npm run test:e2e   # E2E tests (Playwright); see e2e/README.md for login credentials
```

## Testing

- **Unit/integration**: `npm test` (Node test runner).
- **E2E (Playwright)**: `npm run test:e2e` runs the Chromium suite; `npm run test:e2e:public` checks the public auth page in Chromium and WebKit. For login → dashboard and print/export flows set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` (real Supabase required). See [e2e/README.md](e2e/README.md).

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (preferred) or `VITE_SUPABASE_ANON_KEY` (legacy)
4. Deploy!

### Supabase Edge Functions

Edge Functions are deployed separately:

```sh
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy
```

Clinical AI remains fail-closed while the deployment policy is `disabled`. The
primary **Import Patient List** flow still supports client-side CSV upload,
paste, column mapping, and import without sending roster content to an AI
provider. Document and image parsing requires `CLINICAL_PHI_LLM_PROVIDER` and
`CLINICAL_PHI_LLM_MODEL` to name one contractually approved provider/model
pair; see [docs/deployment.md](docs/deployment.md#clinical-import-provider-approval).

## Features

- **Patient Rounding**: 10-system review (neuro, CV, resp, renal/GU, GI, endo, heme, infectious, skin/lines, dispo)
- **Medication Management**: Infusions, scheduled, PRN categories
- **Clinical Phrases**: Reusable text blocks with team sharing
- **AI Integration**: Clinical assistant, text transformation, medication formatting
- **Export**: PDF, Excel, HTML-to-PDF
- **Offline Support**: Service worker with offline mutation queue

## Project Structure

```
src/
├── components/      # React components
│   ├── ui/          # shadcn/ui base components
│   ├── dashboard/   # Dashboard views
│   └── mobile/      # Mobile-specific components
├── hooks/           # Custom React hooks
├── contexts/        # React Context providers
├── pages/           # Route pages
├── types/           # TypeScript definitions
├── services/        # Business logic
├── api/             # API client
├── integrations/    # Supabase integration
└── lib/             # Utilities

supabase/
├── functions/       # Edge Functions (serverless)
└── migrations/      # Database migrations
```

## License

Private project. All rights reserved.
