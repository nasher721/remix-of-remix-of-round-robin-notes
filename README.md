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

- Node.js 20+ (recommended: use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- npm or bun

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
```

## Available Scripts

```sh
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # Run ESLint
npm run preview    # Preview production build
npm test           # Run tests
```

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
