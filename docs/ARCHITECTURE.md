# Architecture Notes

## Test Directory Structure

```
tests/
├── unit/         # Isolated logic tests
├── integration/  # Cross-module tests
├── e2e/          # Workflow coverage
├── fixtures/     # Shared data factories
└── README.md
```

## Fixtures and Test Data

- Shared fixtures live under `tests/fixtures/`.
- Keep fixtures deterministic and lightweight to avoid flaky tests.
- Favor explicit data objects over factories when a test only needs a small dataset.
