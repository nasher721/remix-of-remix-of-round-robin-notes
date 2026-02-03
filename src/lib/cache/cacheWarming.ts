import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS, CACHE_CONFIG } from './cacheConfig';
import { logInfo } from '@/lib/observability/logger';

export interface WarmingProgress {
  total: number;
  completed: number;
  current: string;
  errors: string[];
}

type ProgressCallback = (progress: WarmingProgress) => void;

// Cache warming strategies
export const cacheWarming = {
  // Warm essential caches on app load
  async warmEssential(
    queryClient: QueryClient,
    userId: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const tasks = [
      { key: 'patients', fn: () => this.warmPatients(queryClient, userId) },
      { key: 'autotexts', fn: () => this.warmAutotexts(queryClient, userId) },
      { key: 'clinicalPhrases', fn: () => this.warmClinicalPhrases(queryClient, userId) },
    ];
    
    const progress: WarmingProgress = {
      total: tasks.length,
      completed: 0,
      current: '',
      errors: [],
    };
    
    for (const task of tasks) {
      progress.current = task.key;
      onProgress?.(progress);
      
      try {
        await task.fn();
        progress.completed++;
      } catch (error) {
        progress.errors.push(`${task.key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      onProgress?.(progress);
    }
  },
  
  // Warm patients data
  async warmPatients(queryClient: QueryClient, userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', userId)
      .order('patient_number');
    
    if (error) throw error;
    
    queryClient.setQueryData(QUERY_KEYS.patients, data || [], {
      updatedAt: Date.now(),
    });
    
    logInfo('cache.warming.completed', {
      userId,
      entity: 'patients',
      count: data?.length || 0,
    });
  },
  
  // Warm autotexts data
  async warmAutotexts(queryClient: QueryClient, userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('autotexts')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    queryClient.setQueryData(QUERY_KEYS.autotexts, data || [], {
      updatedAt: Date.now(),
    });
    
    logInfo('cache.warming.completed', {
      userId,
      entity: 'autotexts',
      count: data?.length || 0,
    });
  },
  
  // Warm clinical phrases data
  async warmClinicalPhrases(queryClient: QueryClient, userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('clinical_phrases')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    queryClient.setQueryData(QUERY_KEYS.clinicalPhrases, data || [], {
      updatedAt: Date.now(),
    });
    
    logInfo('cache.warming.completed', {
      userId,
      entity: 'clinical_phrases',
      count: data?.length || 0,
    });
  },
  
  // Warm templates data
  async warmTemplates(queryClient: QueryClient, userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    queryClient.setQueryData(QUERY_KEYS.templates, data || [], {
      updatedAt: Date.now(),
    });
    
    logInfo('cache.warming.completed', {
      userId,
      entity: 'templates',
      count: data?.length || 0,
    });
  },
  
  // Warm user dictionary
  async warmUserDictionary(queryClient: QueryClient, userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('user_dictionary')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    queryClient.setQueryData(QUERY_KEYS.userDictionary, data || [], {
      updatedAt: Date.now(),
    });
    
    logInfo('cache.warming.completed', {
      userId,
      entity: 'user_dictionary',
      count: data?.length || 0,
    });
  },
  
  // Prefetch related data on hover/focus
  async prefetchPatient(queryClient: QueryClient, patientId: string): Promise<void> {
    if (!CACHE_CONFIG.prefetch.enabled) return;
    
    // Prefetch todos for this patient
    await queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.patientTodos(patientId),
      queryFn: async () => {
        const { data } = await supabase
          .from('patient_todos')
          .select('*')
          .eq('patient_id', patientId);
        return data || [];
      },
      staleTime: CACHE_CONFIG.staleTime.todos,
    });
    
    // Prefetch field history
    await queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.fieldHistory(patientId),
      queryFn: async () => {
        const { data } = await supabase
          .from('patient_field_history')
          .select('*')
          .eq('patient_id', patientId)
          .order('changed_at', { ascending: false })
          .limit(50);
        return data || [];
      },
      staleTime: CACHE_CONFIG.staleTime.fieldHistory,
    });
  },
};

// Service worker cache warming
export async function warmServiceWorkerCache(urls: string[]): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return false;
  }
  
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    
    channel.port1.onmessage = (event) => {
      resolve(event.data?.success || false);
    };
    
    navigator.serviceWorker.controller.postMessage(
      { type: 'PRECACHE_URLS', payload: { urls } },
      [channel.port2]
    );
    
    setTimeout(() => resolve(false), 5000);
  });
}
