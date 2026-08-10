## Learned User Preferences

- Prefer staging and committing only intentional source changes; leave out `.DS_Store` and unrelated untracked paths unless explicitly requested.
- Prefer a simple, clean, easy UI for ICU attendings, residents, and fellows taking notes during rounds, with limiting note burden as the primary goal.
- Want the Import Patient List flow (not Epic-specific naming) to accept nearly any file type, parse each patient/room, and organize extracted data into the appropriate chart sections.

## Learned Workspace Facts

- `App.tsx` uses static imports for `Auth`, `FHIRCallback`, and `PrintExportTest` because lazy route chunks can fail to resolve (for example stale service worker caches or headless browser sessions), which otherwise leaves Suspense stuck on the loading fallback.
- Radix `SelectItem` must not use `value=""` (empty string is reserved for clearing the selection); use an explicit sentinel value for placeholder-style options.
- The app is oriented around ICU rounding workflows (dashboard and chart note entry during rounds).
- The rolling rounds intro video should not appear in the app.
- Patient-list import follows extract → parse → organize in `src/lib/import/` (`extractImportContent`, `patientListImportSafety`, `organizeImportedPatient`); the dashboard entry is labeled Import Patient List.
- Supported patient-list inputs include Word, Excel/CSV/TSV, HTML, JSON, RTF, images (OCR), and plain text; client-side PDF import stays blocked until the PDF processor is bundled securely (export as text/Word/Excel or paste instead).
