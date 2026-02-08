# Test Suite Overview

This project uses the Node.js built-in test runner with a TypeScript loader.

## Structure

```
tests/
├── unit/         # Pure functions and isolated logic
├── integration/  # Component interactions and data flow
├── e2e/          # End-to-end workflows (non-UI)
├── fixtures/     # Shared test data factories
└── README.md     # This documentation
```

## Running tests

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

## Skipped tests

No tests are skipped. If a test must be skipped, add a clear reason and an issue reference.
