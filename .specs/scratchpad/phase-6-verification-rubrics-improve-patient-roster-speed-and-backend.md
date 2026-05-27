# Phase 6 Verification Rubrics Scratchpad

Task: `.specs/tasks/draft/improve-patient-roster-speed-and-backend.feature.md`

## Objective

Define LLM-as-Judge verification gates for every Phase 5 implementation step. The task file remains the source of truth; this scratchpad records the design choices, Judge 5 notes incorporated, and evaluation counts.

## Inputs Used

- Task file: `.specs/tasks/draft/improve-patient-roster-speed-and-backend.feature.md`
- Phase 4 decomposition: `.specs/scratchpad/phase-4-decomposition-improve-patient-roster-speed-and-backend.md`
- Phase 5 parallelization: `.specs/scratchpad/phase-5-parallelization-improve-patient-roster-speed-and-backend.md`

## Judge 5 Notes Incorporated

- Added one judge gate for each of the 11 implementation steps.
- Added verification level, required sub-agent judge perspectives, custom rubric, threshold, and dependencies for every step.
- Added explicit MUST requirements for panel and per-item sub-agent participation.
- Clarified that Step 11 final integration depends on recorded Step 1-10 judge outcomes.
- Clarified that judging must evaluate concrete evidence, not intent.
- Clarified that no step uses `None` verification.

## Coverage Map

| Required verification theme | Covered by judge gates |
| --- | --- |
| Roster visibility | Steps 2, 3, 4, 9, 11 |
| Input focus/no microanimation | Steps 2, 5, 11 |
| Frontend responsiveness | Steps 2, 3, 4, 11 |
| Duplicate request/cache behavior | Steps 2, 6, 7, 8, 9, 11 |
| Import/backend active path | Steps 1, 6, 8, 9, 10, 11 |
| Accessibility/reduced-motion | Steps 2, 3, 4, 5, 11 |
| Final integration | Step 11 |

## Verification Breakdown

| Verification level | Steps | Step count | Evaluation count model | Evaluation count |
| --- | --- | ---: | --- | ---: |
| Panel | 2, 3, 4, 5, 8, 9 | 6 | 3 required sub-agent perspectives per step | 18 |
| Single | 1, 6, 7, 10 | 4 | 1 required sub-agent perspective per step | 4 |
| Per-Item | 11 | 1 | 14 acceptance criteria | 14 |
| None | none | 0 | Not used | 0 |

Total implementation steps with verification: 11.

Total evaluations defined: 36.

## Threshold Strategy

- Baseline and contract inventory must pass before regression harness work proceeds.
- Regression harness must pass before implementation fan-out begins.
- UI panel gates fail on missing visible roster capacity, hidden controls, inaccessible active state, horizontal overflow, or missing static focus evidence.
- Backend/cache gates fail on duplicate full reloads, broken public hook return shapes, broad unjustified invalidation, import conflict regressions, or evidence-free schema work.
- Final integration uses per-acceptance-criterion judging so a broad summary cannot hide a failed requirement.

## Write Scope Check

Allowed writes used:

- Updated task file: `.specs/tasks/draft/improve-patient-roster-speed-and-backend.feature.md`
- Created scratchpad: `.specs/scratchpad/phase-6-verification-rubrics-improve-patient-roster-speed-and-backend.md`

No source files were edited.
