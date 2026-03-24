import { supabase } from '@/integrations/supabase/client'

const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/**
 * Headers required for direct fetch() to Supabase Edge Functions.
 * The JS client's `functions.invoke` adds these automatically; raw fetch must pass both.
 * @see https://supabase.com/docs/guides/functions
 */
export async function getEdgeFunctionAuthHeaders(
  extra?: HeadersInit,
): Promise<Record<string, string>> {
  if (!publishableKey) {
    throw new Error('Supabase is not configured (missing publishable/anon key).')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  let accessToken = session?.access_token

  if (!accessToken) {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session?.access_token) {
      accessToken = data.session.access_token
    }
  }

  if (!accessToken) {
    throw new Error('Please sign in to use AI features.')
  }

  const base: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    apikey: publishableKey,
  }

  if (extra) {
    if (extra instanceof Headers) {
      extra.forEach((value, key) => {
        base[key] = value
      })
    } else if (Array.isArray(extra)) {
      for (const [key, value] of extra) {
        base[key] = value
      }
    } else {
      Object.assign(base, extra as Record<string, string>)
    }
  }

  return base
}
