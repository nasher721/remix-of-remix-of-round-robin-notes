# Phase 5 Parallelization Scratchpad

Task: `.specs/tasks/draft/improve-patient-roster-speed-and-backend.feature.md`

Prior handoff consulted: `.omx/plans/phase-5-parallelize-patient-roster-speed-backend.md`

## Objective

Reorganize the Phase 4 implementation decomposition for maximum safe parallel execution while keeping the task file as the source of truth. This retry intentionally writes the plan into `.specs/tasks/draft/improve-patient-roster-speed-and-backend.feature.md` and keeps this scratchpad under `.specs/scratchpad/`.

## Inputs Used

- Phase 2a research: `.specs/scratchpad/phase-2a-patient-roster-performance-research.md`
- Phase 3 architecture synthesis: `.specs/scratchpad/phase-3-architecture-synthesis-improve-patient-roster-speed-and-backend.md`
- Phase 4 decomposition: `.specs/scratchpad/phase-4-decomposition-improve-patient-roster-speed-and-backend.md`
- Optional prior handoff: `.omx/plans/phase-5-parallelize-patient-roster-speed-backend.md`

## Judge 4 Notes Incorporated

- Added a summary table.
- Added a Definition of Done.
- Added grouping labels.
- Split backend/cache work into:
  - patient fetch/cache
  - todo hydration
  - mutation invalidation
  - import behavior
  - evidence-gated migration/index check
- Added explicit dependencies and `parallel-with` markers.
- Added agent assignments using only the provided agent pool.
- Added an execution directive.
- Added a simple dependency/parallelization diagram.
- Added a traceability table.

## Parallelization Shape

Implementation steps reorganized: 11.

Maximum safe parallelization depth: 5 concurrent implementation lanes after baseline:

1. Group B / Step 3: Desktop roster UX
2. Group C / Step 4: Mobile roster UX
3. Group D / Step 5: Textbox motion removal
4. Group E1 / Step 6: Patient fetch/cache
5. Group E2 / Step 7: Todo hydration

Backend/cache work then narrows into two parallel follow-up lanes:

1. Group E3 / Step 8: Mutation invalidation
2. Group E4 / Step 9: Import behavior

Group E5 / Step 10 and Group F / Step 11 are merge-gated.

## Execution Directive Summary

Use a baseline-first, fan-out, merge-gated execution model.

1. Group A owns baseline status, contract inventory, and regression fixtures before any source edits.
2. Groups B, C, D, E1, and E2 can proceed in parallel after Group A.
3. E3 mutation invalidation waits for E1 and E2.
4. E4 import behavior waits for E1 and Group A import-path findings.
5. E5 migration/index check waits for backend/cache evidence and must not add a migration without measured need.
6. Group F owns integrated verification, changed-file review, and final DoD signoff.

## Agent Distribution

| Agent | Steps |
| --- | --- |
| `test-engineer` | 1-2 |
| `explore` | 1 support |
| `performance benchmarker` | 2, 10, 11 |
| `executor` | 3-9 |
| `designer` | 3 |
| `accessibility auditor` | 3-5 |
| `style-reviewer` | 5 |
| `backend architect` | 6-10 |
| `security-reviewer` | 8, 10 |
| `verifier` | 11 |
| `code-reviewer` | 11 |

## Dependency Diagram

```text
Group A
  Step 1 Baseline Checks and Contract Inventory
  Step 2 Regression Harness and Fixtures
        |
        v
  +-----+----------------+----------------+----------------+----------------+
  |                      |                |                |                |
  v                      v                v                v                v
Group B              Group C          Group D          Group E1         Group E2
Step 3 Desktop       Step 4 Mobile    Step 5 Inputs    Step 6 Patient   Step 7 Todo
Roster UX            Roster UX        Motion           Fetch/Cache      Hydration
  |                      |                |                |                |
  +----------+-----------+----------------+----------------+--------+-------+
             \                                           /          |
              v                                         v           v
            Group E3 Step 8 Mutation Invalidation   Group E4 Step 9 Import Behavior
                         |                                  |
                         +----------------+-----------------+
                                          v
                         Group E5 Step 10 Evidence-Gated Migration/Index Check
                                          |
                                          v
                         Group F Step 11 Integrated Verification
```

## Traceability Summary

| Requirement / Judge Note | Covered by steps |
| --- | --- |
| Show multiple patients after add/import | 2, 3, 4, 9, 11 |
| Remove textbox microanimations | 2, 5, 11 |
| Optimize speed without new dependencies | 2, 3, 4, 6, 7, 8, 11 |
| Improve backend active dashboard paths only | 6, 7, 8, 9, 10 |
| Preserve `usePatients.ts` re-export boundary | 1, 6, 11 |
| Split backend/cache work | 6, 7, 8, 9, 10 |
| Todo hydration must avoid duplicate fetches | 2, 7, 8, 11 |
| Import behavior must preserve conflict semantics | 1, 9, 11 |
| Migration/index work is evidence-gated | 10, 11 |
| Accessibility and reduced motion remain intact | 3, 4, 5, 11 |

## Write Scope Check

Allowed writes used:

- Updated task file: `.specs/tasks/draft/improve-patient-roster-speed-and-backend.feature.md`
- Created scratchpad: `.specs/scratchpad/phase-5-parallelization-improve-patient-roster-speed-and-backend.md`

No source files were edited. No `.omx/plans` files were written.
