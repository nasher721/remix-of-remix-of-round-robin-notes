/**
 * Input Sanitization Utilities
 * 
 * Provides functions for sanitizing user input to prevent XSS and injection attacks.
 * 
 * @module sanitize
 */

/**
 * HTML entities to escape
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize a string for safe display
 * Removes potential script injection and trims whitespace
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove on* event handlers
  sanitized = sanitized.replace(/\bon\w+\s*=/gi, '');

  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitize input for use in SQL queries (additional layer, RLS handles most cases)
 * Note: Supabase uses parameterized queries, so this is an extra precaution
 */
export function sanitizeForQuery(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove SQL injection patterns
  return input
    .replace(/'/g, "''") // Escape single quotes
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comment start
    .replace(/\*\//g, '') // Remove block comment end
    .trim();
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') {
    return 'unnamed';
  }

  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, '');

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Replace unsafe characters with underscores
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.match(/\.[^.]+$/)?.[0] || '';
    sanitized = sanitized.substring(0, 255 - ext.length) + ext;
  }

  return sanitized || 'unnamed';
}

/**
 * Sanitize URL to prevent open redirect attacks
 */
export function sanitizeUrl(url: string, allowedHosts: string[] = []): string | null {
  if (typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url, window.location.origin);

    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    // If allowedHosts is specified, check against it
    if (allowedHosts.length > 0) {
      const isAllowed = allowedHosts.some(
        (host) => parsed.hostname === host || parsed.hostname.endsWith('.' + host)
      );
      if (!isAllowed) {
        return null;
      }
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize patient name (alphanumeric, spaces, hyphens, periods)
 */
export function sanitizePatientName(name: string): string {
  if (typeof name !== 'string') {
    return '';
  }

  return name
    .replace(/[^a-zA-Z0-9\s\-.,'']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

/**
 * Sanitize bed/room number
 */
export function sanitizeBedNumber(bed: string): string {
  if (typeof bed !== 'string') {
    return '';
  }

  return bed
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .toUpperCase()
    .substring(0, 20);
}

/**
 * Create a sanitized version of an object's string properties
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  sanitizer: (value: string) => string = sanitizeText
): T {
  const result = { ...obj };

  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = sanitizer(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = sanitizeObject(
        value as Record<string, unknown>,
        sanitizer
      );
    }
  }

  return result;
}
