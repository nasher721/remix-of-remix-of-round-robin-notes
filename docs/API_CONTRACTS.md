# API Contracts Documentation

This document describes the standardized API contracts for the Round Robin Notes application.

## Overview

All API endpoints now follow a standardized response format to ensure consistency, better error handling, and improved developer experience.

## Standard Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-03-06T15:30:00.000Z",
    "version": "1.0.0",
    "requestId": "1234567890_abc123",
    "pagination": { ... },  // Optional
    "duration": 150  // Optional, in milliseconds
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": { ... },  // Optional
    "requestId": "1234567890_abc123"
  },
  "meta": {
    "timestamp": "2024-03-06T15:30:00.000Z",
    "version": "1.0.0",
    "requestId": "1234567890_abc123"
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid request format or parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `TIMEOUT` | 504 | Request timeout |
| `PATIENT_NOT_FOUND` | 404 | Patient record not found |
| `INVALID_PHRASE` | 400 | Invalid clinical phrase |
| `AI_PROCESSING_ERROR` | 500 | AI processing failed |
| `FHIR_CONNECTION_ERROR` | 502 | FHIR server connection failed |

## Edge Functions

### AI Clinical Assistant

**Endpoint:** `POST /functions/v1/ai-clinical-assistant`

**Request:**
```json
{
  "feature": "clinical_summary",
  "text": "Patient presented with...",
  "context": {
    "patientName": "John Doe",
    "clinicalSummary": "...",
    "labs": "...",
    "medications": {
      "infusions": ["Drug A"],
      "scheduled": ["Drug B"],
      "prn": ["Drug C"]
    }
  },
  "model": "gpt-4o",
  "stream": false
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "result": "Generated clinical summary...",
    "model": "gpt-4o",
    "feature": "clinical_summary"
  },
  "meta": {
    "timestamp": "2024-03-06T15:30:00.000Z",
    "version": "1.0.0",
    "requestId": "1234567890_abc123",
    "duration": 2500
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "AI_PROCESSING_ERROR",
    "message": "Failed to process AI request",
    "requestId": "1234567890_abc123"
  },
  "meta": {
    "timestamp": "2024-03-06T15:30:00.000Z",
    "version": "1.0.0",
    "requestId": "1234567890_abc123"
  }
}
```

### Transcription

**Endpoint:** `POST /functions/v1/transcribe-audio`

**Request:**
```json
{
  "audio": "base64-encoded-audio-data",
  "language": "en"
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "text": "Transcribed text...",
    "confidence": 0.95,
    "language": "en"
  },
  "meta": {
    "timestamp": "2024-03-06T15:30:00.000Z",
    "version": "1.0.0",
    "requestId": "1234567890_abc123",
    "duration": 1500
  }
}
```

## Validation

### Request Validation

All requests are validated using the validation utilities in `supabase/functions/_shared/validation.ts`.

Example:
```typescript
import { validateSchema, AIClinicalAssistantSchema, formatValidationErrors } from '../_shared/mod.ts';

const result = validateSchema(body, AIClinicalAssistantSchema);

if (!result.valid) {
  return createValidationErrorResponse(
    request,
    formatValidationErrors(result.errors)
  );
}
```

### Response Validation (Frontend)

Use the Zod schemas in `src/types/api.ts` for runtime validation:

```typescript
import { AIClinicalAssistantResponseSchema, isApiError } from '@/types/api';

const response = await fetch('/functions/v1/ai-clinical-assistant', { ... });
const data = await response.json();

// Validate response structure
const parsed = AIClinicalAssistantResponseSchema.safeParse(data);

if (!parsed.success) {
  console.error('Invalid response format');
  return;
}

if (isApiError(parsed.data)) {
  console.error('API error:', parsed.data.error.message);
  return;
}

// Use the validated data
console.log(parsed.data.result);
```

## TypeScript Types

### API Response Types

```typescript
import { ApiResponse, ApiError, ApiMetadata, PaginationInfo } from '@/types/api';

// Generic response type
interface MyData {
  id: string;
  name: string;
}

type MyResponse = ApiResponse<MyData>;

// Type guards
import { isApiSuccess, isApiError } from '@/types/api';

function handleResponse(response: ApiResponse<MyData>) {
  if (isApiSuccess(response)) {
    // response.data is MyData
    console.log(response.data.name);
  }
  
  if (isApiError(response)) {
    // response.error is ApiError
    console.error(response.error.message);
  }
}
```

## Frontend Usage

### Using the Standardized API Client

```typescript
import { apiClient } from '@/api/client';
import { AIClinicalAssistantRequest, AIClinicalAssistantResponse } from '@/types/api';

const response = await apiClient.post<AIClinicalAssistantResponse>(
  '/functions/v1/ai-clinical-assistant',
  {
    feature: 'clinical_summary',
    text: 'Patient presented with...',
  } as AIClinicalAssistantRequest
);

if (isApiError(response)) {
  throw new Error(response.error.message);
}

return response.data;
```

### Error Handling

```typescript
import { createErrorResponse, isApiError } from '@/types/api';

try {
  const response = await fetchAIResponse(request);
  
  if (isApiError(response)) {
    // Handle specific error codes
    switch (response.error.code) {
      case 'RATE_LIMITED':
        showRetryDialog(response.error.details?.retryAfter);
        break;
      case 'AI_PROCESSING_ERROR':
        showError('AI service temporarily unavailable');
        break;
      default:
        showError(response.error.message);
    }
    return;
  }
  
  // Handle success
  displayResult(response.data.result);
} catch (error) {
  // Handle network or unexpected errors
  logError('AI request failed', { error });
  showError('An unexpected error occurred');
}
```

## Pagination

For paginated endpoints, include pagination info in the response:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "timestamp": "2024-03-06T15:30:00.000Z",
    "version": "1.0.0",
    "requestId": "1234567890_abc123",
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Using Pagination Helpers

```typescript
import { createPaginationInfo } from '@/types/api';

// In Edge Function
const pagination = createPaginationInfo(page, perPage, totalCount);
return createSuccessResponse(request, data, { pagination });
```

## Request IDs

Every request is assigned a unique request ID that is:
1. Generated by the client or server
2. Returned in the response metadata
3. Included in error responses for debugging
4. Logged for tracing

Include a request ID in your requests:
```typescript
headers: {
  'X-Request-ID': generateRequestId(),
}
```

## Migration Guide

### From Old Format

Old responses were inconsistent:
```json
// Old format - varied between endpoints
{ "result": "...", "success": true }
{ "data": "...", "error": null }
{ "text": "..." }
```

### To New Format

All responses now use the standardized format:
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }
}
```

### Frontend Migration

Update your API calls:

```typescript
// Before
const response = await fetch('/functions/v1/ai-clinical-assistant', ...);
const data = await response.json();
const result = data.result; // May be undefined

// After
const response = await fetch('/functions/v1/ai-clinical-assistant', ...);
const data = await response.json();

if (isApiSuccess(data)) {
  const result = data.data.result; // Type-safe access
}
```

## Testing

### Testing API Responses

```typescript
import { createSuccessResponse, createErrorResponse } from '@/types/api';

// In tests
const mockSuccess = createSuccessResponse(
  { result: 'test' },
  'test-request-id'
);

const mockError = createErrorResponse(
  'VALIDATION_ERROR',
  'Invalid input',
  'test-request-id',
  { field: 'email', issue: 'required' }
);
```

## Best Practices

1. **Always use type guards** - Use `isApiSuccess()` and `isApiError()` for safe response handling
2. **Include request IDs** - Pass `X-Request-ID` header for request tracing
3. **Handle all error codes** - Implement specific handling for each error code
4. **Validate responses** - Use Zod schemas for runtime validation
5. **Log errors** - Use the observability utilities for consistent error logging

## Related Documentation

- [Error Handling](./ERROR_HANDLING.md)
- [Observability](./OBSERVABILITY.md)
- [Testing Guide](./TESTING.md)
