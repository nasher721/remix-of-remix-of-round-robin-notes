# Testing & Reliability

## Test Framework

- **Runner:** Node.js built-in test runner (`node --test`) with a TypeScript loader (`scripts/ts-loader.mjs`).
- **Coverage:** Node.js experimental coverage (`--experimental-test-coverage`).

## Test Commands

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

## Test Organization

```
tests/
├── unit/
├── integration/
├── e2e/
├── fixtures/
└── README.md
```

- **Unit tests:** Pure functions and isolated logic.
- **Integration tests:** Cross-module data flow and transformations.
- **E2E tests:** Workflow-level tests (non-UI).
- **Fixtures:** Shared data factories and stubs.

## Coverage Requirements

- **Target threshold:** 80%+ overall coverage, with critical paths at 100%.
- **Focus:** business logic, error handling, and edge cases.

## CI/CD Integration

The CI workflow runs unit + integration tests and produces coverage artifacts.
See `.github/workflows/test.yml` for details.

## Pre-commit Hooks

To enable the provided pre-commit hook:

```bash
git config core.hooksPath .githooks
```

This runs `npm run test:unit` before each commit.

## Skipped Test Handling

Skipped tests are not allowed without:
- A clear reason
- A linked issue reference
- A re-enabling condition

**Current status:** No skipped tests detected.

## Reliability Practices

- Use deterministic test data (no random inputs).
- Mock external integrations in unit tests.
- Keep tests independent and fast.
