# 2026-08-11 — Release hold: Phase 0 deployment-risk assessment

**Status:** HOLD remains in effect. Clinical production use is NOT approved.
**Incident/release owner:** Nash (web engineering). Pilot users must not be told
this build is clinically production-ready.

## Findings (verified 2026-08-11, ~21:10 local)

### Frontend (Vercel production)

- Production URL: `https://remix-of-remix-of-round-robin-notes.vercel.app/`
- Served entry bundle: `/assets/index-Bi_xN442.js` (~2.47 MB)
- Bundle contains **zero** occurrences of `revision`. Source at `434200a`
  references the optimistic-concurrency `revision` field in 11+ client modules,
  so production is serving a **pre-`434200a` build** (Vercel's `npm ci` install
  fails on the same lockfile defect that broke CI, so Git auto-deploy never
  shipped the release commit).

### Database (Supabase project `zsavxqvnseqxusfwdovu`, "RollingRounds")

- `public.patients.revision` column: **absent**
- `bump_patient_revision` trigger: **absent**
- `public.round_state` table: present
- Remote migration history does **not** contain
  `20260811000000_add_patient_optimistic_revision`.
- Remote history also shows version drift vs. local filenames:
  `add_distributed_edge_rate_limits` recorded as `20260811014046` (local file
  `20260711230000_...`) and `create_round_state` as `20260811133644` (local file
  `20260811000000_...`). Local repo additionally has two files sharing the
  `20260811000000` version prefix, which `supabase db push` cannot apply
  cleanly. This must be repaired as part of Phase 2.

## Risk verdict

The dangerous split-brain scenario (revision-aware frontend against a
revision-less schema) is **NOT live**: frontend and database are both
pre-release and mutually consistent. No production rollback of Vercel is
required tonight. The release stays held until Phases 1–2 complete and the
backend deploys ahead of the frontend.

## Acceptance tracking

- [x] Frontend and database schema versions explicitly recorded (above).
- [x] No production client performs revision-aware writes against a
      revision-less schema (verified: live bundle has no revision code path).
- [x] Release hold documented here; owner: Nash.
