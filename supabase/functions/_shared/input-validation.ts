/**
 * Input Validation & Payload Security for Edge Functions
 * 
 * Provides request body validation, payload size limits,
 * and schema checking to prevent abuse and malformed input.
 */

import { errorResponse } from "./cors.ts";

// ─── Size Limits ──────────────────────────────────────────────
const MAX_JSON_PAYLOAD_BYTES = 5 * 1024 * 1024;    // 5 MB for standard JSON
const MAX_MEDIA_PAYLOAD_BYTES = 25 * 1024 * 1024;   // 25 MB for audio/images
const MAX_STRING_FIELD_CHARS = 100_000;              // 100K chars per text field
const MAX_NAME_CHARS = 500;
const MAX_IMAGES = 20;

export type ValidationResult<T = unknown> =
    | { valid: true; data: T }
    | { valid: false; response: Response };

/**
 * Parse and validate the request body with size limits.
 * Returns the parsed JSON body or an error Response.
 */
export async function parseAndValidateBody<T = Record<string, unknown>>(
    req: Request,
    options?: { maxBytes?: number }
): Promise<ValidationResult<T>> {
    const maxBytes = options?.maxBytes ?? MAX_JSON_PAYLOAD_BYTES;

    // Check Content-Length header first (fast reject)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
        return {
            valid: false,
            response: errorResponse(req, 'Request payload too large', 413),
        };
    }

    try {
        // Read body as text to check actual size
        const bodyText = await req.text();

        if (bodyText.length > maxBytes) {
            return {
                valid: false,
                response: errorResponse(req, 'Request payload too large', 413),
            };
        }

        if (!bodyText.trim()) {
            return {
                valid: false,
                response: errorResponse(req, 'Request body is empty', 400),
            };
        }

        const data = JSON.parse(bodyText) as T;
        return { valid: true, data };
    } catch (_err) {
        return {
            valid: false,
            response: errorResponse(req, 'Invalid JSON in request body', 400),
        };
    }
}

// ─── Field Validators ─────────────────────────────────────────

/** Validate a required string field exists and is within length limits */
export function requireString(
    value: unknown,
    fieldName: string,
    maxLength = MAX_STRING_FIELD_CHARS
): string | { error: string } {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return { error: `Missing required field: ${fieldName}` };
    }
    if (value.length > maxLength) {
        return { error: `Field '${fieldName}' exceeds maximum length of ${maxLength} characters` };
    }
    return value;
}

/** Validate an optional string field is within length limits */
export function optionalString(
    value: unknown,
    maxLength = MAX_STRING_FIELD_CHARS
): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') return undefined;
    return value.slice(0, maxLength);
}

/** Validate a string is one of allowed values */
export function requireEnum<T extends string>(
    value: unknown,
    fieldName: string,
    allowed: readonly T[]
): T | { error: string } {
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
        return { error: `Invalid ${fieldName}. Must be one of: ${allowed.join(', ')}` };
    }
    return value as T;
}

/** Validate an array of strings (e.g., medication lists) */
export function validateStringArray(
    value: unknown,
    fieldName: string,
    maxItems = 100,
    maxItemLength = 1000
): string[] | { error: string } {
    if (!Array.isArray(value)) {
        return { error: `Field '${fieldName}' must be an array` };
    }
    if (value.length > maxItems) {
        return { error: `Field '${fieldName}' exceeds maximum of ${maxItems} items` };
    }
    for (const item of value) {
        if (typeof item !== 'string') {
            return { error: `All items in '${fieldName}' must be strings` };
        }
        if (item.length > maxItemLength) {
            return { error: `Item in '${fieldName}' exceeds maximum length` };
        }
    }
    return value as string[];
}

/** Validate images array (base64 data URIs) */
export function validateImageArray(
    value: unknown,
    maxImages = MAX_IMAGES
): string[] | { error: string } {
    if (!Array.isArray(value)) {
        return { error: 'Images must be an array' };
    }
    if (value.length > maxImages) {
        return { error: `Maximum ${maxImages} images allowed` };
    }
    for (const item of value) {
        if (typeof item !== 'string') {
            return { error: 'Each image must be a string (base64 data URI)' };
        }
        // Basic data URI format check
        if (!item.startsWith('data:image/') && !item.startsWith('http')) {
            return { error: 'Images must be data URIs or URLs' };
        }
    }
    return value as string[];
}

// ─── Schema Definitions for Each Edge Function ────────────────

/** Allowed transform types for transform-text */
export const ALLOWED_TRANSFORM_TYPES = [
    'comma-list',
    'medical-shorthand',
    'custom',
] as const;

/** Allowed section values for generate-todos */
export const ALLOWED_TODO_SECTIONS = [
    'all',
    'clinical_summary',
    'interval_events',
    'imaging',
    'labs',
    'cv', 'resp', 'neuro', 'gi', 'renalGU',
    'heme', 'infectious', 'endo', 'skinLines', 'dispo',
] as const;

// ─── Sanitize Error Messages ──────────────────────────────────

/**
 * Create a safe error message that doesn't leak internal details.
 * Use in catch blocks instead of passing error.message directly.
 */
export function safeErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
    if (error instanceof Error) {
        // Only pass through known safe error patterns
        const safePatterns = [
            'Rate limit exceeded',
            'not configured',
            'OPENAI_API_KEY',
            'No audio data',
            'Missing required',
            'Invalid',
            'too large',
            'AI service',
            'Payment required',
            'credits',
        ];

        for (const pattern of safePatterns) {
            if (error.message.includes(pattern)) {
                return error.message;
            }
        }
    }

    // Don't leak internal error details
    return fallback;
}

// ─── Convenience: Method Check ────────────────────────────────

/** Validate that request uses an allowed HTTP method */
export function requireMethod(
    req: Request,
    allowed: string | string[] = 'POST'
): Response | null {
    const methods = Array.isArray(allowed) ? allowed : [allowed];
    if (!methods.includes(req.method)) {
        return errorResponse(req, `Method ${req.method} not allowed`, 405);
    }
    return null;
}

export {
    MAX_JSON_PAYLOAD_BYTES,
    MAX_MEDIA_PAYLOAD_BYTES,
    MAX_STRING_FIELD_CHARS,
    MAX_NAME_CHARS,
    MAX_IMAGES,
};
