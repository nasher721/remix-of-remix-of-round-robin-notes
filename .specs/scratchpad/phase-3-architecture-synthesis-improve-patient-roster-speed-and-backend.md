# Phase 3 Architecture Synthesis Scratchpad

Task: `.specs/tasks/draft/improve-patient-roster-speed-and-backend.feature.md`
Analysis source: `.specs/analysis/analysis-improve-patient-roster-speed-and-backend.md`
Skill source: `.claude/skills/patient-roster-performance/SKILL.md`

## Inputs Synthesized

- Business request: show more patients after add/import, remove distracting textbox microanimations, improve perceived speed, and improve backend behavior without changing the clinical workflow.
- Phase 2b analysis: preserve judged hook contracts for `usePatients`, `usePatientFetch`, `usePatientMutations`, `usePatientImport`, `usePatientTodos`, and `useAllPatientTodos`.
- Skill guidance: fix roster visibility through layout, remove input motion centrally, use existing React Query/Supabase paths, avoid new dependencies, and add focused regression coverage before behavior cleanup.
- Codebase check: desktop roster/detail/tasks are composed through `DesktopDashboard` and `VirtualizedPatientList`; mobile patient list already uses `react-window`; patients already use React Query; all-patient todos are currently a custom bulk Supabase hook.

## Architecture Decisions

1. Layout-first desktop roster fix in `VirtualizedPatientList`, coordinated with `DesktopDashboard` body sizing.
2. Preserve existing mobile `react-window` list and adjust height/compact reachability only where needed.
3. Remove input/textarea microanimations centrally while preserving static focus-visible indicators.
4. Preserve canonical patient hook boundaries and return shapes.
5. Align patients and todos with existing TanStack Query cache keys and immutable cache updates.
6. Keep selected todo hydration using `initialTodos` or shared todo state to prevent duplicate per-patient fetches.
7. Treat Supabase schema/index work as evidence-gated and reversible; do not route dashboard CRUD through `clinical-mcp-server`.

## Components and Contracts Identified

- Dashboard shell: `src/pages/Index.tsx`, `src/components/dashboard/DesktopDashboard.tsx`, `src/components/dashboard/MobileDashboard.tsx`
- Desktop roster/detail/tasks: `src/components/dashboard/VirtualizedPatientList.tsx`, `src/components/PatientCard.tsx`, `src/components/PatientTodos.tsx`
- Mobile roster/detail: `src/components/mobile/VirtualizedMobilePatientList.tsx`, `src/components/mobile/MobilePatientDetail.tsx`
- Form controls: `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`
- Patient hooks: `src/hooks/usePatients.ts`, `src/hooks/patients/index.ts`, `src/hooks/patients/usePatientFetch.ts`, `src/hooks/patients/usePatientMutations.ts`, `src/hooks/patients/usePatientImport.ts`
- Todo hooks: `src/hooks/usePatientTodos.ts`, `src/hooks/useAllPatientTodos.ts`
- Context contracts: `src/contexts/DashboardContext.tsx`, `src/contexts/DashboardTodosContext.tsx`
- Cache layer: `src/lib/cache/cacheConfig.ts`, `src/lib/cache/queryClientConfig.ts`, `src/lib/cache/cacheInvalidation.ts`, `src/lib/cache/cacheWarming.ts`, `src/hooks/useCacheWarming.ts`, `src/hooks/useCacheMonitor.ts`
- Optional backend/schema surface: `supabase/migrations/*` only if query evidence requires a reversible index or migration.

## Implementation-Ready Notes

- Start with tests for roster visibility, focus behavior, reduced motion, and duplicate request prevention.
- Keep `src/hooks/usePatients.ts` as a direct re-export; do not move public API types there.
- Preserve `usePatientTodos(patientId, { initialTodos })` short-circuit behavior.
- Prefer one dashboard todo-map load for the census and scoped cache updates for selected todo mutations.
- Keep visible focus states and active roster state accessible via keyboard and `aria-current`.
