## Learnings

### Pre-existing LSP Errors
- PrintSettings.tsx line 586: Type incompatibility with ColumnWidthsType (number | undefined vs number) — pre-existing
- PrintExportModalFull.tsx line 491: Missing import for PatientTodo type — pre-existing
- PrintDocument.tsx: Multiple lint warnings (dangerouslySetInnerHTML, forEach return value) — pre-existing, clinical HTML content
- These should NOT be introduced by our changes. Fix if touched, but don't regress.

### Codebase Conventions
- Uses `@/` import alias
- shadcn/ui components in `src/components/ui/`
- Tailwind CSS with `cn()` utility from `src/lib/utils.ts`
- Lucide React icons
- Print state uses useReducer pattern in usePrintState.ts
- PrintExportModalFull has its OWN settings state (separate from usePrintState) — dual state issue
- Settings synced to localStorage AND Supabase user_settings table
- @media print rules in src/index.css lines 275-295 (minimal)
- No Tailwind print: utilities used in TSX components currently
- TypeScript is loose (noImplicitAny: false, strictNullChecks: false)

### PrintSettings.tsx Overhaul (2026-03-26)

**Changes made:**
- Reorganized into 5 collapsible Accordion sections: Layout, Typography, Template Options, Combine Sections, Columns, Column Widths
- Layout and Typography default open (`defaultValue={["layout", "typography"]}`); others closed
- Added column search/filter Input with Search icon above the checkbox list
- Added Select All (CheckSquare icon) and Deselect All (Square icon) buttons for columns
- Column Widths section now shows ONLY enabled columns' WidthControls (via `enabledWidthColumns` memo)
- Each section trigger shows a contextual Badge (orientation, font size, headerStyle, active count, enabled count, adjustable count)
- All accordion animations respect `prefers-reduced-motion` via `motion-reduce:transition-none`
- Removed dead imports: Popover, PopoverContent, PopoverTrigger, Palette, Settings2, SYSTEM_LABELS_SHORT, SYSTEM_KEYS
- Removed the Popover-based widths UI — replaced with direct inline WidthControl rendering
- Fixed pre-existing ColumnWidthsType type issue by using `as ColumnWidthsType` cast
- Consolidated "Style" + "Headers & Footers" into a single "Template Options" section per task spec

**File size:** 781 lines (was 761). Slightly larger due to new features (search, select all/deselect all, enabled-only width logic). The Popover removal saved ~20 lines but new features added ~40.

**Props interface:** PrintSettingsProps is UNCHANGED — no breaking changes.
**All existing functionality preserved:** custom combinations, column toggles, width sliders, reset, etc.
**Verification:** LSP diagnostics clean (0 errors), `tsc --noEmit` clean (0 errors), ESLint clean (0 errors).

**Key pattern:** `enabledWidthColumns` useMemo maps enabled column keys to width slider configs, checking `enabledKeys.has(col.key)` against the ColumnWidthsType. System columns are grouped into a single "System Columns" slider.
