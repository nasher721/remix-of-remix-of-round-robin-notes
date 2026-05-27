# SDD Phase 2b Analysis (Post-Judge Correction)

Task: `/Users/Nash/RRobin/.specs/tasks/draft/improve-patient-roster-speed-and-backend.feature.md`

## Required judge fixes addressed

- `src/hooks/usePatients.ts`
  - Must remain a direct re-export only and must not define `ReturnType` alias types there.
  - Current contract: `export { usePatients } from "./patients"`.
- `src/hooks/patients/index.ts`
  - Must be the canonical API boundary and keep stable shape:
    - `usePatients(): { patients, loading, addPatient, addPatientWithData, updatePatient, removePatient, duplicatePatient, toggleCollapse, collapseAll, clearAll, importPatients, refetch: fetchPatients }`
- `src/hooks/patients/usePatientFetch.ts`
  - Must define `PatientFetchState` contract:
    - `patients: Patient[]; loading: boolean; patientCounter: number; patientsRef: MutableRefObject<Patient[]>; setPatients: Dispatch<SetStateAction<Patient[]>>; setPatientCounter: React.Dispatch<React.SetStateAction<number>>; fetchPatients: () => Promise<void>`
- `src/hooks/patients/usePatientMutations.ts`
  - Must expose `PatientMutationsDeps` + mutation handlers for add/update/remove/duplicate/collapse/clear.
- `src/hooks/patients/usePatientImport.ts`
  - Must expose `PatientImportDeps` and import APIs: `importPatients`, `addPatientWithData` with user/config validation + toast/error handling.

## Impacted map (expanded)

- `src/components/dashboard/VirtualizedPatientList.tsx`
  - Uses `useDashboard` + `useDashboardTodos`; selected-patient state from `desktopSelectedPatientId`.
  - Selected path currently uses `usePatientTodos(selectedPatient?.id, { initialTodos: todosMap[selectedPatient.id] ?? [] })`.
- `src/components/PatientCard.tsx`
  - Selected-patient/todo path:
    - Can consume `sharedPatientTodos` to keep Desktop card and tasks rail in sync.
    - Falls back to local `usePatientTodos(patient.id, { initialTodos })`.
  - Risk note: duplicated todo hydrations if both `initialTodos` and `sharedPatientTodos` contracts drift.
- `src/components/mobile/MobilePatientDetail.tsx`
  - Selected-patient/todo path:
    - `usePatientTodos(patient.id, { initialTodos })` for mobile detail render.
  - Risk note: if `initialTodos` is stale on patient switch, visible todo list can misalign until refetch; dedupe guard must remain around selected patient hydration.
- `src/pages/Index.tsx`
  - Composes patient source and todo cache:
    - `usePatients` → dashboard contexts
    - `useAllPatientTodos(patientIds)` → `DashboardTodosContext`
- `src/hooks/useAllPatientTodos.ts`
  - `useAllPatientTodos(patientIds)` currently returns `{ todosMap, loading, refetch }` (bulk cache layer for selected-patient optimization).
- Backend/cache entry points
  - `src/hooks/useOfflineMutation.ts`
  - `src/hooks/useCacheWarming.ts`
  - `src/hooks/useCacheMonitor.ts`
  - `src/lib/cache/queryClientConfig.ts`
  - `src/lib/cache/cacheInvalidation.ts`
  - `src/lib/cache/cacheWarming.ts`
  - Risk note: broad invalidation can create duplicate in-flight requests and stale todo hydration during rapid selection.

## `usePatientTodos(patientId, options)` return surface (required)

`usePatientTodos(patientId: string | null, options?: { initialTodos?: PatientTodo[] }): {`

- `todos: PatientTodo[]`
- `loading: boolean`
- `generating: boolean`
- `addTodo: (content: string, section?: string | null) => Promise<PatientTodo | undefined>`
- `toggleTodo: (todoId: string) => Promise<void>`
- `deleteTodo: (todoId: string) => Promise<void>`
- `generateTodos: (patient: Patient, section: TodoSection) => Promise<void>`
- `getTodosBySection: (section: string | null) => PatientTodo[]`
- `getPatientWideTodos: () => PatientTodo[]`
- `refetch: () => Promise<void>`

Important behavior to preserve: `initialTodos` is a short-circuit hydration mechanism; if provided, skip immediate fetch to prevent duplicated per-patient queries after `useAllPatientTodos` has already loaded data.

## Risk + rollback/test notes (per-file, one-line)

- `src/components/dashboard/VirtualizedPatientList.tsx` — Why: selection state and desktop todo badge counts ride shared map + selected patient, risk of focus/keyboard regressions if list memoization changes.
- `src/components/PatientCard.tsx` — Why: high-frequency re-render boundary plus shared todo API surface; risk of duplicate todo hydration if `initialTodos` and internal `addTodo` path diverge.
- `src/components/mobile/MobilePatientDetail.tsx` — Why: primary mobile selected-patient detail path, risk of initial todo duplication + stale hydration after rapid patient navigation.
- `src/hooks/usePatientTodos.ts` — Why: central todo contract under judge gate, risk of request dedupe regression if `initialTodos` short-circuit and `refetch` timing are changed.
- `src/hooks/useAllPatientTodos.ts` — Why: bulk cache layer for selected-patient optimization, risk of stale map hydration and request storm if patientId list churn isn’t throttled.
- `src/lib/cache/cacheInvalidation.ts` — Why: global invalidation boundaries control duplicate reads/writes, risk of over-invalidation and duplicate network churn.
- `src/lib/cache/cacheWarming.ts` / `src/hooks/useCacheWarming.ts` — Why: cold-start performance and prefetch behavior, risk of heavy startup fetch bursts on low-bandwidth sessions.
- `src/hooks/useCacheMonitor.ts` — Why: instrumentation visibility for network/cache regressions, risk of metrics path overhead in constrained devices.
- `src/lib/cache/queryClientConfig.ts` — Why: stale/retry policy drives speed/consistency tradeoff, risk of over-refresh or stale UI when offline-first boundaries are strict.
- `src/components/dashboard/MobileDashboard.tsx` — Why: roster visibility and mobile path continuity, risk of mobile virtualization fallback regression with search/filter controls.
- `src/components/mobile/VirtualizedMobilePatientList.tsx` — Why: roster virtualization performance path, risk of mobile list truncation/scroll regressions under import-heavy census.
- `src/pages/Index.tsx` — Why: end-to-end wiring and auth-protected dashboard shell, risk of breaking fallback behavior if patient/todo fetch contract changes.

## Integration points to verify in implementation

- Selected-patient hydration path: `useAllPatientTodos(patientIds)` -> `DashboardTodosContext` -> `VirtualizedPatientList` -> `PatientCard` (`sharedPatientTodos` in desktop) / `MobilePatientDetail` (`initialTodos` path).
- Cache backend layer: `queryClientConfig` + `cacheInvalidation` + `cacheWarming` + `useCacheWarming` + `useCacheMonitor` + `useOfflineMutation`.
- Scope controls from task: preserve reduced-motion and focus-visible paths while removing microinteraction-only input/textarea noise; preserve mobile virtualization and not alter auth or task workflows.
