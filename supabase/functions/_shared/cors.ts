/**
 * Shared CORS configuration for Edge Functions
 * Restricts origins to known application domains
 */

// Allowed origins for CORS - add your production domains here
const ALLOWED_ORIGINS = [
  'https://id-preview--ef738429-6422-423b-9027-a14e31e88b4d.lovable.app',
  'https://ef738429-6422-423b-9027-a14e31e88b4d.lovableproject.com',
  'https://lkjylvrhwebxyahzblfl.supabase.co',
  // Lovable preview domains pattern
];

// Check if origin matches Lovable preview pattern
const isLovableOrigin = (origin: string): boolean => {
  return /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
         /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin);
};

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  
  // Check if origin is allowed
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || isLovableOrigin(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// For backwards compatibility - static headers for simple cases
export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
