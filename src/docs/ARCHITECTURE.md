# Architecture Overview

This document describes the high-level architecture of the Patient Rounding Assistant application.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| State Management | TanStack Query (React Query) |
| Backend | Lovable Cloud (Supabase) |
| Database | PostgreSQL with Row Level Security |
| Authentication | Supabase Auth |
| File Storage | Supabase Storage |

## Directory Structure

```
src/
├── components/           # React components
│   ├── ui/              # shadcn/ui primitives
│   ├── dashboard/       # Main dashboard components
│   ├── mobile/          # Mobile-specific components
│   ├── ibcc/            # IBCC reference panel
│   ├── labs/            # Lab fishbone display
│   ├── phrases/         # Clinical phrase management
│   ├── print/           # Print/export functionality
│   └── layout/          # Layout components
├── contexts/            # React contexts
├── hooks/               # Custom React hooks
├── lib/                 # Utility libraries
│   ├── cache/           # Caching infrastructure
│   └── offline/         # Offline support
├── pages/               # Route components
├── types/               # TypeScript type definitions
├── data/                # Static data and content
├── constants/           # Application constants
└── test/                # Test utilities and setup
```

## Core Design Patterns

### 1. Feature-Based Organization
Components are organized by feature (e.g., `ibcc/`, `phrases/`, `print/`) rather than by type, making it easier to find and maintain related code.

### 2. Container/Presentation Pattern
- **Container components** handle data fetching and state
- **Presentation components** focus on rendering UI

### 3. Custom Hooks for Business Logic
All data fetching and complex state management is encapsulated in custom hooks:
- `usePatients()` - Patient CRUD operations
- `useAuth()` - Authentication state
- `useClinicalPhrases()` - Phrase management
- `useSettings()` - User preferences

### 4. Optimistic Updates
Mutations use optimistic updates for instant feedback, with automatic rollback on failure.

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        React Components                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Custom Hooks (usePatients, etc.)         │
│                     TanStack Query for caching               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Supabase Client                          │
│                     (src/integrations/supabase/client.ts)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Lovable Cloud Backend                    │
│                     PostgreSQL + Row Level Security          │
└─────────────────────────────────────────────────────────────┘
```

## Security Architecture

### Row Level Security (RLS)
All database tables use RLS policies to ensure users can only access their own data:

```sql
-- Example policy
CREATE POLICY "Users can only view their own patients"
ON patients FOR SELECT
USING (auth.uid() = user_id);
```

### Authentication Flow
1. User signs in via email/password
2. Supabase issues JWT token
3. Token stored in localStorage
4. All API calls include token in Authorization header
5. RLS policies validate access on every request

## Caching Strategy

### Multi-Layer Caching
1. **React Query** - In-memory cache for API responses
2. **Service Worker** - Offline cache for static assets and API data
3. **localStorage** - Persistent cache for user preferences

### Cache Invalidation
- Automatic invalidation on mutations
- Smart invalidation patterns for related data
- Manual invalidation available via cache utilities

## Offline Support

The application supports offline operation through:
1. Service Worker caching of static assets
2. Offline mutation queue for pending changes
3. Automatic sync when connection restored
4. Visual indicator for offline state

## Performance Optimizations

### Code Splitting
- Route-level code splitting with React.lazy()
- Component-level lazy loading for heavy features

### Rendering Optimizations
- React.memo for expensive components
- useCallback/useMemo for stable references
- Virtualization for long lists

### Bundle Optimization
- Tree shaking enabled
- Manual chunk splitting for vendors
- Asset optimization and compression

## Testing Strategy

### Unit Tests
- Component tests with React Testing Library
- Hook tests with renderHook
- Utility function tests

### Integration Tests
- User flow tests
- API integration tests with MSW

### Coverage Goals
- Critical paths: >80%
- Overall: >70%

## Error Handling

### Error Boundaries
- Page-level boundaries for route errors
- Component-level boundaries for feature errors
- Data-level boundaries for fetch errors

### API Error Handling
- Centralized error parser
- User-friendly error messages
- Automatic retry for network errors
- Error logging and tracking

## Monitoring & Logging

### Client-Side Logging
- Structured logging with log levels
- Log buffering for crash reports
- Performance tracking

### Web Vitals
- LCP, FID, CLS tracking
- Performance budget monitoring
- Real-time metrics in development
