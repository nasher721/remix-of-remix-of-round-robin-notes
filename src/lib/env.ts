/**
 * Environment Variable Validation & Configuration
 * 
 * This module validates all required environment variables at startup
 * and exports typed, validated environment values.
 * 
 * @module env
 */

import { z } from 'zod';

/**
 * Schema for validating environment variables
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string({ required_error: 'VITE_SUPABASE_URL is required' })
    .url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string({ required_error: 'VITE_SUPABASE_PUBLISHABLE_KEY is required' })
    .min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY cannot be empty'),
  VITE_SUPABASE_PROJECT_ID: z
    .string({ required_error: 'VITE_SUPABASE_PROJECT_ID is required' })
    .min(1, 'VITE_SUPABASE_PROJECT_ID cannot be empty'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed values
 * @throws {Error} If any required environment variable is missing or invalid
 */
function validateEnv(): Env {
  const envVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
  };

  const result = envSchema.safeParse(envVars);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    
    const errorMessage = `❌ Environment variable validation failed:\n${errors}\n\nPlease ensure all required environment variables are set.`;
    
    // In production, we don't want to expose detailed error messages
    if (import.meta.env.PROD) {
      console.error('Environment configuration error. Check server logs.');
      throw new Error('Application configuration error');
    }
    
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  return result.data;
}

/**
 * Validated environment variables
 * Access these instead of using import.meta.env directly
 */
export const env = validateEnv();

/**
 * Check if the application is running in development mode
 */
export const isDev = import.meta.env.DEV;

/**
 * Check if the application is running in production mode
 */
export const isProd = import.meta.env.PROD;

/**
 * Re-validate environment on demand (useful for testing)
 */
export function revalidateEnv(): Env {
  return validateEnv();
}
