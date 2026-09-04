# Extensive code review and improvement plan

## Objective

Improve release confidence without speculative redesign: identify reproducible correctness, security, performance, and maintainability defects in the current `main` branch; add regression coverage for behavior-changing fixes; implement only high-confidence, reviewable changes; and verify the repository's established quality gates.

## Constraints

- Preserve the pre-existing `.opencode/package-lock.json` modification.
- Add no dependencies.
- Preserve the clinical rounding workflow and existing public contracts.
- Prefer deletion, reuse, and small boundary fixes over new abstractions.
- Do not commit, push, deploy, or mutate external services unless explicitly requested.

## Review lanes

1. Establish baseline: lint, typecheck, unit tests, production build, security configuration checks, production dependency audit, and edge-function checks when the required runtime is available.
2. Review correctness and security boundaries: authentication/authorization, sensitive data handling, offline synchronization, imports, Supabase calls, and error propagation.
3. Review performance and maintainability: React lifecycle behavior, repeated/unbounded work, large bundles, duplicated logic, and unsafe type escapes.
4. Rank findings by impact and evidence. Implement critical/high-confidence fixes first; avoid cosmetic churn.
5. For each behavior change, add a failing regression test before the implementation when practical.
6. Re-run targeted tests after each fix, then the full local verification suite.

## Acceptance criteria

- Every code change maps to a concrete finding with file-level evidence.
- Regression tests cover each corrected behavior where testable.
- Lint, typecheck, unit tests, and production build pass.
- Security/configuration checks and production dependency audit pass, or any environment/tooling limitation is reported precisely.
- Final report lists findings fixed, files changed, simplifications, verification results, and remaining risks.
