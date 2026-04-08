# Print/Export System Overhaul

## Objective
Modernize the print/export experience to feel like a professional document tool (Google Docs Print dialog, Notion export). Fix broken pagination, overhaul the overwhelming settings panel, improve print CSS, enhance mobile print, and clean up export controls.

## Architecture Summary
- **Orchestrator**: `src/components/PrintExportModalFull.tsx` (780 lines)
- **Settings**: `src/components/print/PrintSettings.tsx` (618 lines) — uses sections from `sections/` dir
- **Controls**: `src/components/print/PrintControls.tsx` (130 lines)
- **Preview**: `src/components/print/PrintPreview.tsx` (271 lines)
- **Document**: `src/components/print/PrintDocument.tsx` (358 lines)
- **Templates**: `src/components/print/PrintTemplateSelector.tsx` (222 lines)
- **Mobile**: `src/components/print/MobilePrintSheet.tsx` (168 lines)
- **Exports**: `src/components/print/ExportHandlers.ts` (1313 lines)
- **State**: `src/components/print/usePrintState.ts` (624 lines)
- **Context**: `src/components/print/PrintContext.tsx` (69 lines)
- **Types**: `src/components/print/types.ts` (87 lines) + `src/lib/print/types.ts`
- **Constants**: `src/components/print/constants.ts` (65 lines)
- **CSS**: `src/index.css` lines 275-295 (minimal @media print)

## Constraints
- Must use existing shadcn/ui components (Accordion, Collapsible, Sheet, Dialog, Tabs, etc.)
- Must preserve existing data contracts (PrintSettings type, PrintDataProps, ColumnConfig, ExportContext)
- Must maintain backward compatibility with existing localStorage keys
- Must keep existing ExportHandlers API
- Must support both desktop and mobile
- Must respect prefers-reduced-motion
- TypeScript is loose (noImplicitAny: false) but no new `any`

---

## TODOs

### Wave 1: HIGH IMPACT (3 parallel tasks)

- [ ] **T1: Settings Panel UX Overhaul** — Convert flat scrollable settings into collapsible Accordion sections with smart defaults. Files: `src/components/print/PrintSettings.tsx`, `src/components/print/sections/LayoutSection.tsx`, `src/components/print/sections/TypographySection.tsx`, `src/components/print/sections/TemplateOptionsSection.tsx`, `src/components/print/sections/ColumnsSection.tsx`, `src/components/print/sections/ColumnWidthsSection.tsx`, `src/components/print/sections/CombineSectionsSection.tsx`. Category: `visual-engineering`. Complexity: L. Skills: `react-expert`, `frontend-ui-ux`.

- [ ] **T2: Export Controls Redesign + Print CSS Foundation** — Redesign export buttons with visual hierarchy (primary Print, secondary PDF/Excel, tertiary More). Add filename customization dialog. Enhance @media print CSS with running headers/footers, proper sandbox hiding, table header repetition. Files: `src/components/print/PrintControls.tsx`, `src/index.css`. Category: `visual-engineering`. Complexity: M. Skills: `react-expert`, `frontend-ui-ux`.

- [ ] **T3: Preview Pagination Fix + View Mode Switcher** — Fix broken `patients.length / 3` pagination math. Add view mode switcher (table/cards/list) directly in preview toolbar. Add fit-to-width option. Show actual page size indicator. Files: `src/components/print/PrintPreview.tsx`. Category: `visual-engineering`. Complexity: M. Skills: `react-expert`.

### Wave 2: MEDIUM IMPACT (2 parallel tasks, depends on Wave 1)

- [ ] **T4: Mobile Print Enhancement** — Expand MobilePrintSheet with: orientation toggle, font size control, template quick-select (compact grid), column toggle summary, filename input, more export formats (Word, TXT). Files: `src/components/print/MobilePrintSheet.tsx`. Category: `visual-engineering`. Complexity: M. Skills: `react-expert`, `frontend-ui-ux`.

- [ ] **T5: Template System Enhancement** — Add confirmation dialog when applying templates (prevents silent override). Add compact template grid view with visual preview badges. Show which settings will change before applying. Files: `src/components/print/PrintTemplateSelector.tsx`. Category: `visual-engineering`. Complexity: S. Skills: `react-expert`.

### Wave 3: INTEGRATION (depends on Wave 1+2)

- [ ] **T6: Modal Layout Integration + PrintDocument Enhancement** — Refactor PrintExportModalFull to use the new settings sections and controls. Add running headers/footers to PrintDocument (physician name, page numbers, timestamp in print output). Add "Copy to clipboard" for text formats. Wire up filename customization. Files: `src/components/PrintExportModalFull.tsx`, `src/components/print/PrintDocument.tsx`. Category: `deep`. Complexity: L. Skills: `react-expert`, `fullstack-guardian`.

### Wave 4: POLISH (optional, lower priority)

- [ ] **T7: PDF Export Quality Improvements** — Improve color extraction robustness, add page break hints from HTML content, improve multi-column layout handling. Files: `src/components/print/ExportHandlers.ts`. Category: `deep`. Complexity: L. Skills: `react-expert`.

---

## Final Verification Wave

- [ ] **F1: Code Review** — Review all changed files for correctness, consistency, and adherence to conventions. Verify no new `any` types, no broken imports, no regressions in existing functionality.
- [ ] **F2: Build Verification** — `npm run build` exits with code 0. `npm run lint` passes with zero errors.
- [ ] **F3: Print Output QA** — Open print preview, verify: pagination works correctly, view mode switcher functions, settings panel sections collapse/expand, print CSS hides sandbox, headers/footers appear in print output.
- [ ] **F4: Mobile Responsive Check** — Verify MobilePrintSheet renders all new controls correctly on mobile viewport. Check touch targets are adequate (min 44px).

---

## Commit Strategy

Each task gets an atomic commit:
1. `feat(print): overhaul settings panel with collapsible accordion sections`
2. `feat(print): redesign export controls with visual hierarchy and print CSS improvements`
3. `fix(print): fix preview pagination and add view mode switcher`
4. `feat(print): enhance mobile print with settings and template access`
5. `feat(print): add template change confirmation and visual preview`
6. `feat(print): integrate modal layout and add running headers/footers`
7. `refactor(print): improve PDF export color and page break handling`
