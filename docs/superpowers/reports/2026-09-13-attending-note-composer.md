# Attending note composer implementation and verification

Implemented locally from the approved September 13 design using test-first cycles. The feature is available through **Compose rounding note** in desktop patient cards, mobile patient detail, and rounds patient focus. Existing Sections and One page editors remain available.

## Delivered workflow

- Temporary source intake using existing safe text, DOCX, RTF, HTML, JSON, and spreadsheet extraction. Every added record starts quarantined until the clinician selects its patient-specific text. Failed sources must be corrected or explicitly excluded. PDF and image OCR remain unavailable in this path.
- Distinct attending input, Standard/Concise modes, a packaged versioned Neuro ICU attending profile, and explicit saving/resetting of the abstract default-mode preference. No patient examples or executable archive instructions were packaged.
- Authenticated patient ownership checks, rate limiting, bounded provider failover, reconciliation, composition, and a separate semantic support check. Only providers explicitly covered by `NOTE_COMPOSER_VERIFIED_PROVIDERS` are eligible; the existing clinical-AI kill switch still applies. No generic text-transform or clinical-memory path is used.
- Complete editable note, scoped proposals, three-way edit protection, explicit removals, evidence inspection, clinician review, exact plain-text copy, in-session undo, cancellation, retry, and temporary-session cleanup.
- Atomic chart application with revision checks, operation IDs, audit history, format metadata, accepted clears, and preservation of unrelated chart fields and attachments. Server conflicts can be loaded and merged for explicit overlap review.

The profile input is the complete non-patient preference list from the archive with SHA-256 `E30A33BB95E1A2A4E76E4665F170FA12C833A22E12D03F2CD2591568AA189746`. Shared precedence rules override conflicting archive formatting and preserve source fidelity and management-relevant details.

## Local verification

| Check | Result |
| --- | --- |
| TypeScript app and Node configurations | Passed |
| ESLint | Passed |
| Full Node unit/component suite | 891 passed |
| Composer browser harness | 12 passed: desktop Chromium, phone Chromium, desktop WebKit |
| Existing continuous/section editor browser harness | 12 passed |
| Edge type checking, lint, and tests | 44 tests passed |
| Edge formatting | Passed with LF normalization; existing tracked Windows CRLF files were restored afterward to avoid unrelated changes |
| Development build | Passed |
| Auth configuration, Edge JWT configuration, migration checks | Passed |
| Client credential canary and direct-provider-origin scan | Passed |
| Optional native dependency reachability | Passed; fixed its existing native-path/space handling with a regression test |
| Production dependency audit, excluding optional/dev dependencies | 0 vulnerabilities |
| PostgreSQL 17 transaction test in an isolated synthetic database | Passed: atomicity, audit rollback, idempotency, stale revisions, ownership, field clears, format metadata, unrelated field preservation |

The browser harness uses synthetic data and an injected transport. It verifies the UI/session workflow, not a hosted model or production account. Clipboard API checks ran in Chromium; exact preview and save/reload checks also ran in WebKit. The SQL fixture uses the actual composer migration with a minimal compatible patient schema and revision trigger. It does not substitute for the repository's hosted authenticated deployment checks.

## Deployment and clinical-release requirements

1. Apply `supabase/migrations/20260914000000_note_composer.sql` before deploying the updated client. It adds accepted note-format metadata, the idempotent apply RPC, and the abstract mode setting. No source/draft/evidence storage table is introduced.
2. Deploy `compose-rounding-note` with its shared modules. Gateway JWT verification remains disabled per this repository's ES256 setup; the handler performs authentication and patient-owner authorization.
3. Verify the actual provider account, endpoint, retention contract, and operational settings against the temporary-source requirement. Only then configure `NOTE_COMPOSER_VERIFIED_PROVIDERS` with the verified provider names (`gemini`, `openai`, or `grok`, matching the shared provider configuration). Failover cannot use an unlisted provider. Application memory handling and `store:false` alone do not establish provider deletion.
4. Verify an authenticated hosted synthetic generation/apply/reload round trip, stale-write conflict, cross-account denial, and provider timeout. These checks were not performed in this local implementation task.
5. Complete the attending-reviewed synthetic pilot below before clinical rollout. No claim of lower note burden, clinical accuracy, or production readiness is made from deterministic tests alone.

Dictation remains disabled because no retention-verified transcription service has been configured for this feature. Unsaved work is intentionally lost on reload/crash. Source evidence is intentionally unavailable after a session ends. Only approved chart fields and abstract format settings persist.

## Reproduce local checks

```powershell
npm run typecheck
npm run lint
npm test
npx playwright test --config playwright.composer.config.ts
npm run test:e2e:notes
npx deno lint supabase/functions
npx deno check --no-config --lock deno.lock --frozen supabase/functions/_shared/*.ts supabase/functions/*/index.ts
npx deno test --no-config --lock deno.lock --frozen supabase/functions
npm run build:dev
npm run edge:check-jwt-config
npm run verify:migrations
npm run security:check-auth-config
npm run security:check-bundle-reachability
```

For the PostgreSQL test, create a disposable database named `composer_test` in a local PostgreSQL/Supabase container. Run `supabase/tests/note_composer_fixture.sql`, the composer migration, then `supabase/tests/note_composer.sql`, using `psql -v ON_ERROR_STOP=1`. The fixture refuses other database names. The test rolls back its synthetic chart changes. The fixture assumes the Supabase `anon` and `authenticated` roles exist.

## Attending evaluation worksheet

Use only the newly authored synthetic cases in `2026-09-13-attending-note-composer-pilot.md`. Alternate baseline-first and composer-first order. Include intake, reading, model waiting, source review, factual corrections, and copying in total time; separately record active editing time.

| Case | Order | Baseline total / active seconds | Composer total / active seconds | Material corrections | Important omissions | Accepted without structural rewrite? |
| --- | --- | --- | --- | --- | --- | --- |
| A | Baseline then composer | Pending | Pending | Pending | Pending | Pending |
| B | Composer then baseline | Pending | Pending | Pending | Pending | Pending |
| C | Baseline then composer | Pending | Pending | Pending | Pending | Pending |

Pilot result: **not yet evaluated by the attending**. Require usable style, improved median total time, and no increase in clinically significant omissions or errors. Any wrong-patient or unsupported material assertion blocks release pending correction and re-evaluation. Report case count and limitations; zero observed errors in a small pilot is not a universal accuracy claim.
