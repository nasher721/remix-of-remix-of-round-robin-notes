# Patient Roster Performance

Use this skill when planning or implementing the task "Improve patient roster visibility, remove input microanimations, and optimize app/backend speed" for Rolling Rounds.

## Scope

- Improve desktop and mobile patient roster visibility without adding dependencies.
- Remove distracting `Input` and `Textarea` click/focus microanimations while preserving visible, accessible focus states.
- Reduce avoidable patient/todo request churn, dashboard re-renders, and slow list interactions.
- Keep existing patient create, import, update, duplicate, remove, search, filter, sort, print/export, and mobile detail workflows intact.

## Repo Anchors

- Dashboard shell: `src/pages/Index.tsx`, `src/components/dashboard/DesktopDashboard.tsx`, `src/components/dashboard/MobileDashboard.tsx`
- Desktop roster/detail rail: `src/components/dashboard/VirtualizedPatientList.tsx`
- Mobile roster: `src/components/mobile/VirtualizedMobilePatientList.tsx`
- Shared controls: `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`
- Data hooks: `src/hooks/usePatients.ts`, `src/hooks/patients/*`, `src/hooks/useAllPatientTodos.ts`
- Context split already in place: `src/contexts/DashboardContext.tsx`, `src/contexts/DashboardTodosContext.tsx`
- Cache config: `src/lib/cache/cacheConfig.ts`, `src/lib/cache/queryClientConfig.ts`
- Backend/schema: `supabase/migrations/*`, `clinical-mcp-server/src/index.ts`

## Recommended Implementation Order

1. Lock behavior with focused tests before visual/perf edits.
   - Add or update e2e coverage that seeds several patients and asserts the desktop roster region exposes multiple patient buttons before scrolling.
   - Add keyboard-focus checks for `Input` and `Textarea`: focus indicator remains visible, but no scale/shake/glow/shadow transition is applied on ordinary focus.
   - Add a reduced-motion check for dashboard/list/input animations where the app already has motion gates.

2. Fix roster visibility with layout, not a new list library.
   - Keep desktop as a persistent sidebar/detail layout; the current desktop component intentionally avoids window virtualization because rich patient cards have varied heights.
   - Make the sidebar consume the available dashboard body height predictably and show multiple compact roster rows by default.
   - Avoid nesting scroll containers in a way that gives the roster a one-card viewport. Check `DesktopDashboard` body height, the parent `ScrollArea`, and `VirtualizedPatientList` sidebar `max-h` together.
   - Preserve the `topbar` roster mode as an alternate compact navigation surface, but do not rely on it as the only fix for visibility.

3. Remove input microanimations centrally.
   - In `Input` and `Textarea`, replace broad `transition-all duration-200` with a narrow static focus treatment: border/ring color only.
   - Remove focus-time shadow/glow classes such as `focus-visible:shadow-*`.
   - Remove invalid-state motion like `aria-[invalid=true]:animate-shake` unless the implementation makes it opt-in and reduced-motion safe.
   - Keep `focus-visible:outline-none focus-visible:ring-2 ... focus-visible:border-*` or an equivalent high-contrast static indicator.
   - Keep hover color changes only if they do not animate or distract during typing.

4. Reduce dashboard re-renders before adding more memoization.
   - Keep `DashboardTodosContext` split from `DashboardContext`; it is already the right direction.
   - Avoid passing newly created objects/functions into memoized row components unless they are wrapped in `useMemo`/`useCallback`.
   - For search, consider `useDeferredValue(searchQuery)` before filtering or passing query text to heavy lists, but only if profiling or interaction tests show typing jank.
   - Use React Profiler or lightweight render counters around `DesktopDashboard`, `VirtualizedPatientList`, `PatientCard`, and mobile roster before and after changes.

5. Use existing React Query cache for patient/todo data.
   - Patients already use `useQuery` and `QUERY_KEYS.patients`; prefer immutable `queryClient.setQueryData` updates after successful mutations over full list refetches.
   - Convert `useAllPatientTodos(patientIds)` to React Query or align it with `QUERY_KEYS.allTodos` / `QUERY_KEYS.patientTodos` so dashboard, selected-patient todos, and print/export share cached data.
   - Include stable query keys that account for the current user and patient ID set if cross-user cache leakage is possible.
   - Keep `staleTime`, `gcTime`, `refetchOnMount`, and `refetchOnWindowFocus` aligned with the existing cache config rather than introducing a second fetching convention.

6. Optimize backend-facing operations without schema churn unless measured.
   - Patient import currently inserts sequentially. For multi-patient handoffs, prefer one bulk insert with precomputed patient numbers when conflict handling permits, then one cache update.
   - Existing migrations already add useful `patient_todos(patient_id)` and `patient_todos(user_id)` indexes plus RLS policy improvements; verify production has run them before adding new indexes.
   - If query performance remains suspect, use Supabase query inspection / `pg_stat_statements` evidence before adding or changing indexes.
   - `clinical-mcp-server` is a separate stdio MCP server for calculations/content/interactions. Do not route dashboard patient/todo CRUD through it unless a separate architecture task requires it.

## Pitfalls

- Do not add another virtualization dependency; `react-window` is already installed and used on mobile.
- Do not use dynamic row heights in `react-window` unless necessary; predetermined row heights are more efficient.
- Do not remove focus indication while removing motion; keyboard users still need a clearly visible focus state.
- Do not use `React.memo` as a blanket fix. It only helps when props remain stable and rendering is pure.
- Do not mutate React Query cached arrays in place; use immutable updates.
- Do not let optimistic patient edits be clobbered by an immediate full refetch unless the rollback path is intentional.

## Verification Ideas

- E2E: authenticated desktop with 8-12 patients shows at least 3 roster buttons in the patient list region at a common laptop viewport.
- E2E: after importing a multi-patient handoff, the roster remains visible and selected detail does not consume the entire list area.
- E2E or component: `Input` and `Textarea` focus via click and tab; computed classes/styles show static ring/border focus but no animated transform, shadow glow, or shake.
- Reduced motion: emulate `prefers-reduced-motion: reduce` and confirm nonessential dashboard/list/input animations do not run.
- Performance: profile search typing, patient selection, todo toggling, and import of a realistic census before/after; check render counts and network request counts.
- Backend: confirm patient fetch is one ordered query, all-patient todos are one batched query, selected-patient todos reuse cache/initial data, and import avoids per-row reloads.

## Evidence Base

Resource count: 29 total, including 16 repo resources and 13 external official/upstream docs.

- React `useMemo`: https://react.dev/reference/react/useMemo
- React `memo`: https://react.dev/reference/react/memo
- React `useDeferredValue`: https://react.dev/reference/react/useDeferredValue
- React `<Profiler>`: https://react.dev/reference/react/Profiler
- `react-window` README/API: https://github.com/bvaughn/react-window
- TanStack Query `useQuery`: https://tanstack.com/query/latest/docs/framework/react/reference/useQuery
- TanStack Query render optimizations: https://tanstack.com/query/v5/docs/framework/react/guides/render-optimizations
- TanStack Query `QueryClient`: https://tanstack.com/query/v5/docs/reference/QueryClient
- Supabase JavaScript filters: https://supabase.com/docs/reference/javascript/using-filters
- Supabase query optimization: https://supabase.com/docs/guides/database/query-optimization
- Supabase database inspection: https://supabase.com/docs/guides/database/inspect
- W3C/WAI focus appearance: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- MDN `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
