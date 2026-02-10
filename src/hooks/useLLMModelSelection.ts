/**
 * useLLMModelSelection
 *
 * React hook for managing LLM model selection in the UI.
 *
 * Provides:
 * - Current model/provider selection
 * - Default model from settings
 * - Available models list (filtered by configured providers)
 * - Model switching
 * - Health check status
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { getLLMRouter, AVAILABLE_MODELS, type ModelOption } from '@/services/llm';
import type { LLMProviderName } from '@/services/llm';

interface UseLLMModelSelectionReturn {
  /** Currently selected provider */
  selectedProvider: LLMProviderName;
  /** Currently selected model */
  selectedModel: string;
  /** Display label for current selection */
  selectedLabel: string;
  /** Available models (only those with configured providers) */
  availableModels: ModelOption[];
  /** Set the current model selection */
  setModel: (provider: LLMProviderName, model: string) => void;
  /** Reset to default model */
  resetToDefault: () => void;
  /** Provider health status */
  providerHealth: Record<string, boolean>;
  /** Check provider health */
  checkHealth: () => Promise<void>;
}

const STORAGE_KEY = 'llm_default_model';

interface StoredSelection {
  provider: LLMProviderName;
  model: string;
}

export function useLLMModelSelection(): UseLLMModelSelectionReturn {
  // Load saved preference from localStorage
  const savedSelection = useMemo((): StoredSelection | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const [selectedProvider, setSelectedProvider] = useState<LLMProviderName>(
    savedSelection?.provider || 'openai'
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    savedSelection?.model || 'gpt-4o-mini'
  );
  const [providerHealth, setProviderHealth] = useState<Record<string, boolean>>({});

  // Filter models to only show those with configured providers
  const availableModels = useMemo(() => {
    const router = getLLMRouter();
    const registeredProviders = new Set(router.listProviders());

    return AVAILABLE_MODELS.filter(m => registeredProviders.has(m.provider));
  }, []);

  const selectedLabel = useMemo(() => {
    const option = AVAILABLE_MODELS.find(
      m => m.provider === selectedProvider && m.model === selectedModel
    );
    return option?.label || `${selectedProvider}/${selectedModel}`;
  }, [selectedProvider, selectedModel]);

  const setModel = useCallback((provider: LLMProviderName, model: string) => {
    setSelectedProvider(provider);
    setSelectedModel(model);

    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, model }));
    } catch {
      // Storage unavailable
    }
  }, []);

  const resetToDefault = useCallback(() => {
    setSelectedProvider('openai');
    setSelectedModel('gpt-4o-mini');

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable
    }
  }, []);

  const checkHealth = useCallback(async () => {
    const router = getLLMRouter();
    const health = await router.healthCheckAll();
    setProviderHealth(health);
  }, []);

  return {
    selectedProvider,
    selectedModel,
    selectedLabel,
    availableModels,
    setModel,
    resetToDefault,
    providerHealth,
    checkHealth,
  };
}
