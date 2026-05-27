# Phase 2a Research: Patient Roster Performance

Task: `.specs/tasks/draft/improve-patient-roster-speed-and-backend.feature.md`

## Request Type

Comprehensive implementation research: React roster visibility/performance, accessible no-motion input focus, and dashboard/backend data-fetch optimization without adding dependencies.

## Resource Count

29 total resources consulted.

- Repo resources: 16
- External official/upstream docs: 13

## Repo Findings

- `VirtualizedPatientList.tsx` is the desktop roster/detail rail. Despite the name, it intentionally avoids desktop virtualization because rich patient cards have varied heights. It renders a left sidebar or topbar roster plus one selected `PatientCard`.
- The current desktop roster can be constrained by a combination of `DesktopDashboard` body height, parent `ScrollArea`, and sidebar `max-h-[calc(100vh-14rem)]`. Fix the available-height chain before changing list behavior.
- Mobile already uses `react-window` in `VirtualizedMobilePatientList.tsx` with fixed row heights, stable `rowProps`, and `overscanCount={3}`.
- Shared `Input` and `Textarea` include broad `transition-all duration-200`; `Input` adds a focus-visible shadow glow and invalid shake; `Textarea` adds invalid shake. These are the central removal points for textbox microanimations.
- Patients already use TanStack Query via `usePatientFetch`, `QUERY_KEYS.patients`, `staleTime`, `gcTime`, and immutable `setQueryData`.
- Todos currently use `useAllPatientTodos(patientIds)` with local state and one Supabase `.in("patient_id", patientIds)` query, while selected-patient todos also use `usePatientTodos` with `initialTodos`. This is a likely duplicate-fetch/re-render improvement target.
- `DashboardTodosContext` is already split from `DashboardContext`, reducing all-dashboard rerenders when only todos change.
- Patient import currently inserts patients sequentially, with conflict retry. Multi-patient handoff import may benefit from bulk insert after preserving patient-number conflict behavior.
- Supabase migrations include patient/todo RLS and later performance indexes on `patient_todos(patient_id)` and `patient_todos(user_id)`. Verify they are applied before proposing more index work.
- `clinical-mcp-server` is a separate stdio MCP server for clinical tools, not the dashboard CRUD backend path.

## Docs Evidence

- React recommends first avoiding unnecessary effects and using the profiler to identify components that actually benefit from memoization. `useMemo` helps skip expensive recalculation or preserve prop identity for memoized children. Source: https://react.dev/reference/react/useMemo
- `React.memo` can skip re-rendering when props are unchanged, but React treats it as a performance optimization, not a semantic guarantee. Source: https://react.dev/reference/react/memo
- `useDeferredValue` can keep typing responsive while a heavy list lags behind, and it works best when the slow child is memoized. Source: https://react.dev/reference/react/useDeferredValue
- React `<Profiler>` reports `actualDuration` and `baseDuration`, useful for proving whether memoization and split contexts reduce rerender cost. Source: https://react.dev/reference/react/Profiler
- `react-window` is already available. Its v2 `List` API expects `rowComponent`, `rowCount`, `rowHeight`, and `rowProps`; predetermined row heights are recommended over dynamic row heights for efficiency, and `overscanCount` reduces edge flicker. Source: https://github.com/bvaughn/react-window
- TanStack Query `useQuery` supports `staleTime`, `gcTime`, `refetchOnMount`, `refetchOnWindowFocus`, `select`, and smart re-render tracking. Source: https://tanstack.com/query/latest/docs/framework/react/reference/useQuery
- TanStack Query render optimizations use structural sharing, tracked properties, and `select`; stable selector references avoid unnecessary selector reruns. Source: https://tanstack.com/query/v5/docs/framework/react/guides/render-optimizations
- TanStack `queryClient.setQueryData` is synchronous and must update cached data immutably; `invalidateQueries` marks matching queries stale and refetches active queries by default. Source: https://tanstack.com/query/v5/docs/reference/QueryClient
- Supabase filters apply to `select`, `update`, `upsert`, and `delete`; the current `.in("patient_id", patientIds)` shape is a supported batched filter pattern. Source: https://supabase.com/docs/reference/javascript/using-filters
- Supabase query optimization guidance starts with aligning indexes to common query patterns; indexes can speed retrieval substantially, but should be evidence-based. Source: https://supabase.com/docs/guides/database/query-optimization
- Supabase inspection docs point to `pg_stat_statements`, cache-hit, index-usage, seq-scans, long-running-queries, and outliers for slow-query evidence. Source: https://supabase.com/docs/guides/database/inspect
- W3C/WAI focus guidance requires a clearly visible focus indicator and warns against focus styles that remove or render indicators non-visible. Source: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- MDN documents `prefers-reduced-motion` as a user preference to remove, reduce, or replace nonessential motion. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion

## Implementation Recommendations

1. Fix desktop roster visibility by making the roster/sidebar height chain explicit and compact, not by adding dependencies. The target is multiple patient selector buttons visible in the sidebar at common laptop heights.
2. Remove shared input motion in `Input`/`Textarea`: replace `transition-all`, focus shadow/glow, and invalid shake with static border/ring focus styles. Preserve `focus-visible` and invalid color states.
3. Keep mobile on `react-window`; only adjust row height/container height if visibility fails. Avoid dynamic row heights unless content makes fixed rows impossible.
4. Move all-patient todos toward TanStack Query cache alignment so dashboard counts, selected-patient todos, and print/export share one batched data source instead of local state plus per-patient hooks.
5. Optimize import and backend work conservatively: consider bulk insert with one cache update for handoff imports, verify existing indexes/RLS migrations are deployed, and use Supabase inspection before adding new indexes.

## Pitfalls

- Blanket `React.memo` can fail if parent-created arrays, objects, or callbacks change every render.
- Broad dashboard context values can still re-render many consumers; keep contexts split and memoized.
- Removing input animation must not remove focus visibility.
- Refetching after every optimistic mutation can erase the responsiveness gained from `setQueryData`.
- Patient-number conflict handling is the hard part of bulk import; preserve it or keep the safer sequential path.

## Verification Ideas

- E2E seeded desktop roster: at least 3 visible patient buttons in the roster region at 1366x768 and 1440x900.
- Import flow: adding a multi-patient list keeps the roster visible and selected detail scrollable without hiding the list.
- Input/textarea focus: click and tab focus show static focus ring/border; no transform, animated shadow, shake, or glow.
- Reduced motion: emulate reduced motion and confirm dashboard/list/input nonessential animations do not run.
- Network/perf: count patient and todo requests during load, selection, todo toggle, and import; compare React Profiler durations for list/search/detail interactions.
