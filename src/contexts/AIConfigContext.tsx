import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logError, logInfo } from '@/lib/observability/logger';
import type { User } from '@supabase/supabase-js';

/**
 * AIConfigContext - AI provider and model configuration
 * 
 * Split from SettingsContext for better performance.
 * Components using this context only re-render when AI config changes.
 */

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'azure' | 'custom';

export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface AIFeatureModels {
  chat: string;
  summary: string;
  todos: string;
  handoff: string;
  insights: string;
  default: string;
}

export interface AIConfigValue {
  // Current provider
  aiProvider: AIProvider;
  
  // Model configs per provider
  aiCredentials: Record<AIProvider, AIModelConfig>;
  
  // Feature-specific model assignments
  aiFeatureModels: AIFeatureModels;
  
  // Actions
  setAiCredential: (provider: AIProvider, config: Partial<AIModelConfig>) => void;
  setAiFeatureModel: (feature: keyof AIFeatureModels, model: string) => void;
  getModelForFeature: (feature: keyof AIFeatureModels) => string;
  resetAiModel: (provider: AIProvider) => void;
  
  // Sync status
  isSyncing: boolean;
}

const AIConfigContext = createContext<AIConfigValue | null>(null);

const STORAGE_KEY = 'rr-ai-config';

const DEFAULT_MODELS: AIFeatureModels = {
  chat: 'gpt-4o',
  summary: 'gpt-4o-mini',
  todos: 'gpt-4o-mini',
  handoff: 'gpt-4o',
  insights: 'gpt-4o',
  default: 'gpt-4o',
};

const DEFAULT_CREDENTIALS: Record<AIProvider, AIModelConfig> = {
  openai: { provider: 'openai', model: 'gpt-4o' },
  anthropic: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
  google: { provider: 'google', model: 'gemini-1.5-pro' },
  azure: { provider: 'azure', model: 'gpt-4o' },
  custom: { provider: 'custom', model: '' },
};

function getInitialConfig(): {
  provider: AIProvider;
  credentials: Record<AIProvider, AIModelConfig>;
  featureModels: AIFeatureModels;
} {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        provider: parsed.provider || 'openai',
        credentials: { ...DEFAULT_CREDENTIALS, ...parsed.credentials },
        featureModels: { ...DEFAULT_MODELS, ...parsed.featureModels },
      };
    }
  } catch {
    // Ignore parsing errors
  }
  return {
    provider: 'openai',
    credentials: DEFAULT_CREDENTIALS,
    featureModels: DEFAULT_MODELS,
  };
}

export function AIConfigProvider({ 
  children,
  user,
}: { 
  children: React.ReactNode;
  user: User | null;
}) {
  const [config, setConfig] = useState(getInitialConfig);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load from database when user changes
  useEffect(() => {
    if (!user) return;

    const loadFromDB = async () => {
      setIsSyncing(true);
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('ai_provider, ai_credentials, ai_feature_models')
          .eq('user_id', user.id)
          .single();

        if (data && !error) {
          setConfig(prev => ({
            provider: data.ai_provider || prev.provider,
            credentials: { ...prev.credentials, ...data.ai_credentials },
            featureModels: { ...prev.featureModels, ...data.ai_feature_models },
          }));
          logInfo('Loaded AI config from database', { source: 'AIConfigContext' });
        }
      } catch (err) {
        logError('Failed to load AI config', { error: String(err), source: 'AIConfigContext' });
      } finally {
        setIsSyncing(false);
      }
    };

    loadFromDB();
  }, [user]);

  // Persist to localStorage immediately
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      logError('Failed to save AI config', { source: 'AIConfigContext' });
    }
  }, [config]);

  const setAiCredential = useCallback((provider: AIProvider, updates: Partial<AIModelConfig>) => {
    setConfig(prev => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [provider]: { ...prev.credentials[provider], ...updates },
      },
    }));
  }, []);

  const setAiFeatureModel = useCallback((feature: keyof AIFeatureModels, model: string) => {
    setConfig(prev => ({
      ...prev,
      featureModels: {
        ...prev.featureModels,
        [feature]: model,
      },
    }));
  }, []);

  const getModelForFeature = useCallback((feature: keyof AIFeatureModels): string => {
    return config.featureModels[feature] || config.featureModels.default;
  }, [config.featureModels]);

  const resetAiModel = useCallback((provider: AIProvider) => {
    setConfig(prev => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [provider]: DEFAULT_CREDENTIALS[provider],
      },
    }));
  }, []);

  const value = useMemo<AIConfigValue>(() => ({
    aiProvider: config.provider,
    aiCredentials: config.credentials,
    aiFeatureModels: config.featureModels,
    setAiCredential,
    setAiFeatureModel,
    getModelForFeature,
    resetAiModel,
    isSyncing,
  }), [
    config.provider,
    config.credentials,
    config.featureModels,
    setAiCredential,
    setAiFeatureModel,
    getModelForFeature,
    resetAiModel,
    isSyncing,
  ]);

  return (
    <AIConfigContext.Provider value={value}>
      {children}
    </AIConfigContext.Provider>
  );
}

export function useAIConfig(): AIConfigValue {
  const context = useContext(AIConfigContext);
  if (!context) {
    throw new Error('useAIConfig must be used within an AIConfigProvider');
  }
  return context;
}

// Convenience hook for just provider selection
export function useAIProvider() {
  const { aiProvider, aiCredentials } = useAIConfig();
  return { aiProvider, currentConfig: aiCredentials[aiProvider] };
}

// Convenience hook for feature models
export function useAIFeatureModels() {
  const { aiFeatureModels, setAiFeatureModel, getModelForFeature } = useAIConfig();
  return { aiFeatureModels, setAiFeatureModel, getModelForFeature };
}
