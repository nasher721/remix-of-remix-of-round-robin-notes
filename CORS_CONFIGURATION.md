# CORS Configuration for Round Robin Notes

## Overview

This document describes the Cross-Origin Resource Sharing (CORS) configuration for the Round Robin Notes Supabase Edge Functions.

## Architecture

```
┌─────────────────┐     CORS Preflight      ┌──────────────────┐
│   Web Client    │ ◄──────────────────────► │  Edge Function   │
│  (Vercel/Local) │    OPTIONS /api/func     │   (Supabase)     │
└─────────────────┘                          └──────────────────┘
         │                                           │
         │  Authenticated Request (POST)            │
         │──────────────────────────────────────────►│
         │  200 OK + CORS Headers                   │
         │◄──────────────────────────────────────────│
         │                                           │
```

## Security Model

- **Origin Allowlist**: Only explicitly allowed origins can access the API
- **No Wildcard with Credentials**: Specific origins only (HIPAA compliance)
- **PHI Protection**: Cross-origin requests from unauthorized origins are blocked
- **Security Headers**: Comprehensive headers on all responses

## Configuration File

**Location**: `supabase/functions/_shared/cors.ts`

### Default Allowed Origins

| Origin | Environment |
|--------|-------------|
| `http://localhost:8080` | Local development (Vite default) |
| `http://localhost:5173` | Local development (Vite alt) |
| `http://localhost:3000` | Local development (Next.js) |
| `http://127.0.0.1:*` | Local development (IP) |
| `https://remix-of-remix-of-round-robin-notes.vercel.app` | Production |
| `https://*.vercel.app` | Preview deployments (pattern match) |

### Environment Variable Override

Set `ALLOWED_ORIGINS` in Supabase secrets (comma-separated):

```bash
supabase secrets set ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"
```

## CORS Headers Reference

### Request Headers (Allowed)
```
Authorization
X-Client-Info
Apikey
Content-Type
X-Request-ID
X-Supabase-Client-*
```

### Response Headers (Exposed)
```
X-Request-ID
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
```

### Security Headers (All Responses)
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cache-Control: no-store, no-cache, must-revalidate
Vary: Origin
```

## Edge Functions Using CORS

All 12 Edge Functions use the shared CORS module:

| Function | File |
|----------|------|
| AI Clinical Assistant | `ai-clinical-assistant/index.ts` |
| Check Drug Interactions | `check-drug-interactions/index.ts` |
| Format Medications | `format-medications/index.ts` |
| Generate Daily Summary | `generate-daily-summary/index.ts` |
| Generate Interval Events | `generate-interval-events/index.ts` |
| Generate Patient Course | `generate-patient-course/index.ts` |
| Generate Todos | `generate-todos/index.ts` |
| Parse Handoff | `parse-handoff/index.ts` |
| Parse Single Patient | `parse-single-patient/index.ts` |
| Transcribe Audio | `transcribe-audio/index.ts` |
| Transform Text | `transform-text/index.ts` |

## Usage in Edge Functions

### Standard Pattern

```typescript
import { corsHeaders, createErrorResponse } from '../_shared/mod.ts';

serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // Process request...
    return new Response(
      JSON.stringify({ data: result }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return createErrorResponse(req, 'Error message', 500);
  }
});
```

### Helper Functions

| Function | Purpose |
|----------|---------|
| `getCorsHeaders(request)` | Get CORS headers for a request |
| `corsHeaders(request)` | Alias for `getCorsHeaders` (deprecated) |
| `handleOptions(request)` | Create OPTIONS preflight response |
| `handlePreflight(request, status)` | Create preflight with custom status |
| `jsonResponse(request, data, status)` | Create JSON response with CORS |
| `successResponse(request, data, status)` | Create success response |
| `errorResponse(request, message, status, code)` | Create error response |
| `forbiddenResponse(request)` | Create 403 for disallowed origins |

## Testing CORS

### Using curl

```bash
# Test preflight
curl -X OPTIONS -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -I https://your-project.supabase.co/functions/v1/ai-clinical-assistant

# Expected response headers:
# Access-Control-Allow-Origin: http://localhost:8080
# Access-Control-Allow-Methods: POST, OPTIONS
# Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type, ...
# Access-Control-Allow-Credentials: true
# Vary: Origin
```

### Using Browser DevTools

1. Open Network tab
2. Make API call from your app
3. Verify preflight OPTIONS request returns 204
4. Verify actual request includes CORS headers

## Troubleshooting

### CORS Error in Browser

**Symptom**: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solutions**:
1. Check origin is in allowlist (including protocol and port)
2. Verify `ALLOWED_ORIGINS` env var is set correctly in Supabase
3. Check function logs for blocked origin messages

### Preflight Fails

**Symptom**: `Response to preflight request doesn't pass access control check`

**Solutions**:
1. Ensure OPTIONS request returns 204 status
2. Verify `Access-Control-Allow-Headers` includes all request headers
3. Check `Vary: Origin` header is present

### Credentials Not Sent

**Symptom**: Auth cookies/headers not included in requests

**Solutions**:
1. Verify `Access-Control-Allow-Credentials: true` is set
2. Client must use `credentials: 'include'` in fetch
3. Origin must be explicit (not wildcard)

## Deployment Checklist

- [ ] Set `ALLOWED_ORIGINS` in Supabase secrets for production
- [ ] Verify production domain is in default allowlist
- [ ] Test from production domain
- [ ] Test from Vercel preview deployments
- [ ] Verify preflight caching works (`Access-Control-Max-Age: 86400`)
- [ ] Test error responses include CORS headers

## Best Practices Applied

1. **Specific Origins Only**: No wildcard (`*`) with credentials
2. **`Vary: Origin` Header**: Prevents cache poisoning across origins
3. **Preflight Caching**: 24-hour cache for OPTIONS responses
4. **Security Headers**: Comprehensive headers on all responses
5. **Environment Separation**: Localhost only in non-production
6. **Pattern Matching**: Supports Vercel preview deployments
7. **Backward Compatibility**: Maintains deprecated aliases

## Changes Made

### 2024-03-07 CORS Update

1. ✅ Added `Vary: Origin` header for caching correctness
2. ✅ Added `Access-Control-Allow-Credentials: true`
3. ✅ Added `X-XSS-Protection` security header
4. ✅ Added `EXPOSED_HEADERS` for rate limit headers
5. ✅ Fixed OPTIONS response body consistency (all use `null`)
6. ✅ Extracted `isOriginAllowed()` for better testability
7. ✅ Added `forbiddenResponse()` helper
8. ✅ Added `successResponse()` helper
9. ✅ Cleaned up unused `createCorsResponse` imports
10. ✅ Added JSDoc comments and deprecation notices

## References

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [OWASP CORS Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Origin_Resource_Sharing_Cheat_Sheet.html)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
