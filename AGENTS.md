## Learned User Preferences

- Prefer staging and committing only intentional source changes; leave out `.DS_Store` and unrelated untracked paths unless explicitly requested.

## Learned Workspace Facts

- `App.tsx` uses static imports for `Auth`, `FHIRCallback`, and `PrintExportTest` because lazy route chunks can fail to resolve (for example stale service worker caches or headless browser sessions), which otherwise leaves Suspense stuck on the loading fallback.
- Radix `SelectItem` must not use `value=""` (empty string is reserved for clearing the selection); use an explicit sentinel value for placeholder-style options.
