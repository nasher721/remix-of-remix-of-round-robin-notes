# Learnings

## 2026-03-26 Print/Export UI Analysis

### Key Files
- `src/components/PrintExportModalFull.tsx` — Main modal orchestrator (783 lines)
- `src/components/print/PrintTemplateSelector.tsx` — Template card list (249 lines)
- `src/components/print/PrintPreview.tsx` — Preview with toolbar (397 lines)
- `src/components/print/PrintSettings.tsx` — Settings accordion (796 lines)
- `src/components/print/PrintDocument.tsx` — Actual print document renderer
- `src/pages/PrintExportTest.tsx` — Dev-only test harness

### Architecture
- The modal has two tabs: "Settings" and "Templates"
- Template selection triggers `handleApplyTemplate` which calls `setSelectedTemplateId` + `applyTemplateSettings`
- The export sandbox (`print-export-sandbox` div, line 770) is a hidden PrintDocument used for export capture — needs to be visually hidden but present in DOM
- `PrintPreview` uses `ScrollArea` from shadcn for the preview content area
- Template badges use raw shorthand: "P" (Portrait), "L" (Landscape), "Nc" (N columns), "Ns" (N sections)

### Existing Selected State
- `PrintTemplateSelector` main variant DOES show selected state (border color + box-shadow + Check icon)
- `PrintTemplateSelectorCompact` variant has border highlight but NO Check icon and NO aria-selected
- Neither variant has `aria-selected` attribute

### State Flow
- `selectedTemplateId` state in `PrintExportModalFull` (line 49)
- Saved to localStorage via `STORAGE_KEYS.PRINT_SELECTED_TEMPLATE_ID`
- `handleApplyTemplate` (line 364) — sets template + applies settings + shows toast
- `handleSaveTemplatePreset` (line 389) — validates name after click (not before)
