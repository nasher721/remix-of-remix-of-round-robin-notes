# Clinical note editor

The patient chart now offers **Sections** and **One page** on desktop and mobile. The device remembers the view preference. Both views update the existing patient fields, timestamps, save queue, and export data.

One page provides a single rich-text editing surface with protected section headings. It includes summary, interval events, systems, labs, imaging text, and medication categories. Documented disabled systems remain visible. Image attachments remain in the chart; use Sections to view or manage them.

Writing tools include section jumps, Alt+Up/Down navigation, Next empty, timestamps, saved phrases, an optional blank assessment/plan/follow-up outline, bold and lists, undo/redo, larger text, and Copy note. Copy omits empty sections and includes references to image attachments. Coverage counts mean text is present, not that clinical review is complete. Undo history is held in memory for the current patient and resets on patient changes or external field replacements.

The one-page medication fields use one medication per line and preserve each structured category. Only edited fields are submitted. No migration or new clinical storage is required.

## Verification

- `npm test`: 819 passing, including field integrity and integration with the real desktop/mobile charts.
- `npm run test:e2e:notes`: 10 passing across desktop Chromium and Chromium with phone emulation, including view switching, preference reload, typing, formatting, outlines, phrases, timestamps, copying, undo/redo, tracked text, protected headings, medication rows/source text, patient isolation, dark mode, and mobile overflow.
- `npm run typecheck`, `npm run lint`, `npm run build:dev`: passing.
- The local browser fixture at `/e2e/notes-harness.html` contains only synthetic data and resets its chart on reload. It is not a production route or a persistence test.
- Restored dependencies from the existing lockfile. Fixed two existing workflow-test assertions to accept Windows CRLF line endings without changing the release requirements.

Not verified: authenticated server persistence end to end, real iOS/Safari, and the browser Animations panel at 10% speed. No new staged motion was added; the note navigator uses a 150ms color transition with reduced-motion suppression. Hover, selected, disabled, empty, focus, and status feedback were inspected in code; desktop and phone dark layouts were visually inspected. Saving indicators continue to belong to the parent chart.

## UI polish review

### Structure and state feedback

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `src/components/notes/NoteEditorModeControl.tsx:5` | Combined systems still used separate editors. | A labeled view switch offers one continuous editor with a persistent selected state. | Explicit state and a discoverable entry reduce navigation during rounds. |
| MEDIUM | `src/components/notes/continuous-note.css:1` | Long note entry displaced writing tools and navigation. | The writing surface scrolls independently beneath a single toolbar. | Keep frequent actions close to the text without duplicating toolbars. |

### Surfaces, hit areas, and motion

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `src/components/notes/ContinuousNoteEditor.tsx:332` | Initial mobile prototype's off-screen accessible labels expanded the page width. | Explicit button labels and a positioned container keep the page within the phone viewport. | Accessible navigation must not introduce horizontal page overflow. |
| MEDIUM | `src/components/notes/continuous-note.css:1` | Dense nested editors and small note text competed with writing. | One bordered document, readable line spacing, 16/20px text, 44px controls, and visible focus. | Borders communicate structure; spacing and touch targets support fast note entry. |

The unverified environments above remain outside this local UI review.

Approve
