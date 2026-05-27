Scratchpad notes for SDD Phase 2c business analysis

Task:
- Improve patient roster visibility, remove input microanimations, and optimize frontend/backend speed for the authenticated Rolling Rounds dashboard.

Core preserved request:
- Show more than one patient after adding/importing a list.
- Remove distracting textbox click/focus motion.
- Make the app and backend faster without expanding product scope.

Implementation-ready bounds:
- Work stays in authenticated dashboard roster, shared inputs/textareas, patient/todo dashboard data paths, and mobile list visibility.
- No new dependencies.
- No auth redesign, production deploy, broad data-model redesign, new import formats, new AI features, or new analytics.

Measurable acceptance shape:
- Desktop 1440x900 with at least 8 patients must show at least 4 roster rows without a one-card viewport.
- Mobile 375px patient tab must avoid horizontal overflow and keep primary controls reachable.
- Input/Textarea focus must retain accessible indication while removing nonessential animation.
- Patient selection must not cause duplicate full patient-list fetches or unnecessary full todo-map reloads when data is already loaded.
- Network failure must not blank the roster when last usable state exists.

Risk notes:
- Roster visibility may be affected by both CSS container sizing and animation timing.
- Backend speed may be confused with frontend state fan-out; implementation should verify request counts before changing database shape.
- Acceptance criteria intentionally require evidence for duplicate-request prevention but do not mandate a specific backend design.
