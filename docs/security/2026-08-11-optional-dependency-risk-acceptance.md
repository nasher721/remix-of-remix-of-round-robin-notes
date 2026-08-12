# Optional dependency risk acceptance — fhirclient → isomorphic-webcrypto → Expo tree

**Date:** 2026-08-12 · **Owner:** web engineering (Nash) · **Reviewers:** security/privacy
**Expiry:** 2026-11-12 (re-review at or before this date; earlier if fhirclient ships a fix)

## Scope

Root `npm audit` (all dependencies, including optional) reports **18 advisories**
(7 moderate, 11 high) in the optional Expo/React-Native tree:

```
root → fhirclient@^2.6.3 → isomorphic-webcrypto (required)
                          └→ expo / @expo/cli / react-native (OPTIONAL)
```

The production audit gate (`npm run audit:prod` = `npm audit --omit=dev --omit=optional`)
reports **0 vulnerabilities** and remains a blocking CI check.

## Evidence

1. **Browser reachability:** `fhirclient` is imported only by
   `src/integrations/fhir/client.ts` (SMART on FHIR launch/callback flow).
   `isomorphic-webcrypto` is a Node-environment shim; fhirclient uses native
   `window.crypto` in browsers.
2. **Bundle inspection (2026-08-12 build):** zero occurrences of
   `expo-modules-core`, `ExpoModulesCore`, `isomorphic-webcrypto`,
   `react-native/Libraries`, or `@expo/config-plugins` in any `dist/assets`
   file. The vulnerable packages are not shipped to browsers.
3. **Automated guard:** `npm run security:check-bundle-reachability`
   (`scripts/assert-no-optional-native-in-bundle.mjs`) now fails CI if any of
   those markers ever appear in a production bundle. Runs in the Web quality
   gates job immediately after `npm run build`.
4. **SBOM:** `docs/security/sbom-2026-08-12.cyclonedx.json` (CycloneDX,
   production dependencies only, generated from a clean Node 22/npm 10
   install matching CI).

## Why not remove/upgrade

`isomorphic-webcrypto` is a **required** dependency of fhirclient; removing it
means patching or replacing fhirclient, which owns the SMART launch/session
machinery — an unjustified change inside the clinical release window. The
advisories affect packages that are (a) optional, (b) build-time-only, and
(c) absent from shipped artifacts.

## Conditions of acceptance

- `security:check-bundle-reachability` must stay green on every CI run.
- `audit:prod` must stay at zero; any new non-optional advisory is blocking.
- Owner monitors fhirclient upstream releases monthly; if a release drops or
  fixes the optional tree, schedule the upgrade.
- This exception expires **2026-11-12**. After that date the finding must be
  either remediated or re-approved with fresh evidence.
