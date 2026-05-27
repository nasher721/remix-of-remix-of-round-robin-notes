# Phase 2b Scratchpad (Second Judge Retry)

Scope: `/Users/Nash/RRobin/.specs/analysis/analysis-improve-patient-roster-speed-and-backend.md`

Scope guard: do not edit source/task files.

Current action for this retry:
- Document hook re-export correction and full cache/todo integration map without introducing implementation changes.

High-risk check matrix (one-line per file with risk):
- `src/hooks/usePatients.ts` — keep as re-export-only for backward compatibility; risk: returning aliased `ReturnType` loses callable contract shape and breaks static imports.
- `src/hooks/patients/index.ts` — canonical `usePatients` API remains authoritative; risk: removing memoization or action ordering increases desktop rerender cadence and duplicates.
- `src/hooks/patients/usePatientFetch.ts` — fetch state contract drives dashboard cold-start and import flows; risk: patientCounter/setPatientCounter mismatch can break add-number assignment and selection sync.
- `src/hooks/patients/usePatientMutations.ts` — mutation surface is the write path boundary; risk: optimistic update mismatch causes todo selection and card render churn.
- `src/hooks/patients/usePatientImport.ts` — import batching and conflict fallback are critical; risk: partial-import semantics regress after duplicate-number retries.
- `src/hooks/useAllPatientTodos.ts` — bulk todo cache used for selected-patient pre-hydration; risk: request dedupe failure creates duplicate full-map + selected patient fetches.
- `src/hooks/usePatientTodos.ts` — selected-patient/local todo contract must preserve `{todos, loading, generating, addTodo, toggleTodo, deleteTodo, generateTodos, getTodosBySection, getPatientWideTodos, refetch}`; risk: initialTodos short-circuit removal triggers duplicate fetch and flicker.
- `src/components/PatientCard.tsx` — sharedPatientTodos + local fallback path needs explicit separation; risk: stale selected-patient todo hydration after quick patient swaps.
- `src/components/mobile/MobilePatientDetail.tsx` — mobile selected detail should use initialTodos hydration only; risk: mobile virtualization + todo flicker if refetch is eager.
- `src/components/dashboard/VirtualizedPatientList.tsx` — keeps list visibility and todo badge counts; risk: reduced-motion and focus accessibility regressions when simplifying row transitions.
- `src/lib/cache/cacheInvalidation.ts` — narrow invalidation strategy; risk: over-invalidation increases duplicate todo/patient reads on selection.
- `src/lib/cache/cacheWarming.ts` / `src/hooks/useCacheWarming.ts` — warm essential caches with bounded progress; risk: startup spikes and offline cache bloat on older devices.
- `src/hooks/useCacheMonitor.ts` — monitoring guardrails; risk: polling/metrics overhead conflicts with low-end mobile memory ceilings.
- `src/lib/cache/queryClientConfig.ts` — offline-first + retry/stale policy center; risk: changed stale/retry boundaries increase either stale data windows or network churn.

Request to complete in implementation:
- Ensure selected-patient/todo path remains: desktop (`VirtualizedPatientList` -> `PatientCard` shared API) and mobile (`MobilePatientDetail` initialTodos short-circuit) with no duplicate per-patient request when bulk map already loaded.
- Preserve reduced-motion focus behavior and mobile list virtualization while removing input microinteractions only where they are non-essential.
