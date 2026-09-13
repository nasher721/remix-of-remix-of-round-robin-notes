import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { PrintPreferenceRepository } from '@/lib/print/preferenceSession';

/** Transport only; ownership, defaults, and save sequencing live in the session. */
export const printPreferenceRepository: PrintPreferenceRepository = {
  async load(ownerId) {
    const { data, error } = await supabase.from('user_settings')
      .select('print_settings').eq('user_id', ownerId).maybeSingle();
    if (error) throw error;
    return data?.print_settings ?? null;
  },
  async save(ownerId, payload) {
    const { error } = await supabase.from('user_settings').upsert({
      user_id: ownerId,
      print_settings: JSON.parse(JSON.stringify(payload)) as Json,
    }, { onConflict: 'user_id' });
    if (error) throw error;
  },
};
