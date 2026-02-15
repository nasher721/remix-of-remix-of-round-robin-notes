

## Problem

The `parse-handoff` edge function works correctly (verified by direct server call returning 200 with valid patient data), but **every browser request fails with "Failed to fetch"**.

The root cause is in `supabase/functions/_shared/cors.ts`. It uses an **origin allowlist** (lines 11-24) that only includes:
- `localhost` variants
- `https://lovable.dev`
- `https://qrlonfgafvyfqqtsasfc.lovable.app`
- `https://remix-of-remix-of-round-robin-notes.lovable.app`
- `https://supabase.com` / `https://qrlonfgafvyfqqtsasfc.supabase.co`

The actual preview URL is `https://id-preview--6495691e-527a-443c-bb38-94c2d93312ba.lovable.app`, which does NOT match any entry. When an origin is not allowed, the function intentionally omits the `Access-Control-Allow-Origin` header (line 66-71), causing the browser to block the response entirely.

This is why:
- Direct API calls (curl) work fine (no CORS enforcement)
- Browser requests fail with "Failed to fetch" (CORS blocks the response)
- Previous "fixes" to CORS header formatting had no effect

## Solution

Update `supabase/functions/_shared/cors.ts` to allow all `*.lovable.app` subdomains by adding a wildcard pattern match. This covers:
- Preview URLs (`id-preview--*.lovable.app`)
- Published URLs (`*.lovable.app`)
- Any future Lovable subdomain

### Changes

**File: `supabase/functions/_shared/cors.ts`**

1. Add `.lovable.app` as a suffix-match pattern in the origin check (line 60-62), so any origin ending in `.lovable.app` is allowed.
2. Keep the existing allowlist for non-Lovable origins (localhost, supabase.com, etc.).

The updated origin check logic:

```typescript
const isAllowed = origin && (
  // Allow any *.lovable.app subdomain (preview, published, etc.)
  origin.endsWith('.lovable.app') ||
  // Check explicit allowlist for non-Lovable origins
  allowedOrigins.some(allowed =>
    origin === allowed || origin.startsWith(allowed + '/')
  )
);
```

This is a one-line change that permanently fixes the CORS issue for all current and future Lovable preview/production URLs, without weakening security for non-Lovable origins.

No other files need to change. The edge function code, client code, and config are all correct.

