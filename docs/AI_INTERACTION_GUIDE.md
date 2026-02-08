# AI Interaction Guide

## Test Quality Expectations

- Add or update tests whenever production logic changes.
- Favor behavior-driven assertions (outputs) over implementation details.
- Ensure new code paths include error and edge-case coverage.

## Automation Rules

- Run unit tests before commit:
  - `npm run test:unit`
- Run integration tests for cross-module changes:
  - `npm run test:integration`

## When to Update Tests

- Public APIs, helpers, or services change behavior.
- New workflows are introduced.
- Bug fixes should include regression tests.
