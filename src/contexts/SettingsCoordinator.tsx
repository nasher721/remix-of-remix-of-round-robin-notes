/**
 * SettingsCoordinator - Coordinates all settings contexts
 * 
 * This provider:
 * 1. Wraps ThemeProvider, AIConfigProvider, LayoutProvider
 * 2. Provides backward-compatible useSettings() hook
 * 3. Enables gradual migration to specialized hooks
 * 
 * New code should use specialized hooks:
 * - useTheme() / useThemeOnly() / useFontSize()
 * - useAIConfig() / useAIProvider() / useAIFeatureModels()
 * - useLayout() / useSortPreference() / useSectionVisibility() / useSpecialty()
 * 
 * Legacy code can continue using useSettings() for backward compatibility.
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ThemeProvider, useTheme, type ThemeMode } from './ThemeContext';
import { AIConfigProvider, useAIConfig, type AIProvider, type AIFeatureModels } from './AIConfigContext';
import { LayoutProvider, useLayout, type SortOption, type SectionVisibility } from './LayoutContext';
import type { SpecialtyFeature } from '@/constants/specialties';
import type { LLMProviderName } from '@/services/llm';

// Re-export new hooks for convenience
export { useTheme, useThemeOnly, useFontSize } from './ThemeContext';
export { useAIConfig, useAIProvider, useAIFeatureModels } from './AIConfigContext';
export { useLayout, useSortPreference, useSectionVisibility, useSpecialty } from './LayoutContext';
export type { ThemeMode, AIProvider, AIFeatureModels, SortOption, SectionVisibility };

/**
 * Legacy SettingsContextType - maintained for backward compatibility
 */
interface LegacySettingsContextType {
  // Theme
  globalFontSize: number;
  setGlobalFontSize: (size: number) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // Layout
  todosAlwaysVisible: boolean;
  setTodosAlwaysVisible: (visible: boolean) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  showLabFishbones: boolean;
  setShowLabFishbones: (show: boolean) => void;
  sectionVisibility: SectionVisibility;
  setSectionVisibility: (visibility: SectionVisibility) => void;
  resetSectionVisibility: () => void;

  // Specialty
  selectedSpecialty: string | null;
  setSelectedSpecialty: (specialtyId: string | null) => void;
  isFeatureEnabledForRole: (feature: SpecialtyFeature) => boolean;

  // AI
  aiProvider: AIProvider;
  aiModel: string;
  aiCredentials: Partial<Record<AIProvider, string>>;
  setAiModel: (provider: AIProvider, model: string) => void;
  resetAiModel: () => void;
  setAiCredential: (provider: AIProvider, credential: string) => void;
  aiFeatureModels: AIFeatureModels;
  setAiFeatureModel: (feature: string, model: string) => void;
  getModelForFeature: (feature: string) => string;

  // Sync
  isSyncingSettings: boolean;
}

const LegacySettingsContext = createContext<LegacySettingsContextType | undefined>(undefined);

/**
 * Internal component that bridges new contexts to legacy interface
 */
function LegacySettingsBridge({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const layout = useLayout();
  const aiConfig = useAIConfig();

  // Bridge layout's setSectionVisibility (takes SectionVisibility) to match legacy interface
  const setSectionVisibilityLegacy = useCallback((visibility: SectionVisibility) => {
    Object.entries(visibility).forEach(([key, value]) => {
      layout.setSectionVisibility(key as keyof SectionVisibility, value);
    });
  }, [layout.setSectionVisibility]);

  // Bridge AI config methods
  const setAiModel = useCallback((provider: AIProvider, model: string) => {
    aiConfig.setAiCredential(provider, { model });
  }, [aiConfig.setAiCredential]);

  const setAiCredential = useCallback((provider: AIProvider, credential: string) => {
    aiConfig.setAiCredential(provider, { apiKey: credential });
  }, [aiConfig.setAiCredential]);

  // Bridge AI config methods
  const setAiModel = (provider: AIProvider, model: string) => {
    aiConfig.setAiCredential(provider, { model });
  };

  const setAiCredential = (provider: AIProvider, credential: string) => {
    aiConfig.setAiCredential(provider, { apiKey: credential });
  };

  // Extract API keys from credentials for legacy interface
  const aiCredentials = useMemo(() => {
    const result: Partial<Record<AIProvider, string>> = {};
    Object.entries(aiConfig.aiCredentials).forEach(([provider, config]) => {
      if (config?.apiKey) {
        result[provider as AIProvider] = config.apiKey;
      }
    });
    return result;
  }, [aiConfig.aiCredentials]);

  const value = useMemo<LegacySettingsContextType>(() => ({
    // Theme
    globalFontSize: theme.globalFontSize,
    setGlobalFontSize: theme.setGlobalFontSize,
    theme: theme.theme,
    setTheme: theme.setTheme,

    // Layout
    todosAlwaysVisible: layout.todosAlwaysVisible,
    setTodosAlwaysVisible: layout.setTodosAlwaysVisible,
    sortBy: layout.sortBy,
    setSortBy: layout.setSortBy,
    showLabFishbones: layout.showLabFishbones,
    setShowLabFishbones: layout.setShowLabFishbones,
    sectionVisibility: layout.sectionVisibility,
    setSectionVisibility: setSectionVisibilityLegacy,
    resetSectionVisibility: layout.resetSectionVisibility,

    // Specialty
    selectedSpecialty: layout.selectedSpecialty,
    setSelectedSpecialty: (id: string | null) => layout.setSelectedSpecialty(id || ''),
    isFeatureEnabledForRole: layout.isFeatureEnabledForRole,

    // AI
    aiProvider: aiConfig.aiProvider,
    aiModel: aiConfig.aiCredentials[aiConfig.aiProvider]?.model || '',
    aiCredentials,
    setAiModel,
    resetAiModel: () => aiConfig.resetAiModel(aiConfig.aiProvider),
    setAiCredential,
    aiFeatureModels: aiConfig.aiFeatureModels,
    setAiFeatureModel: aiConfig.setAiFeatureModel,
    getModelForFeature: aiConfig.getModelForFeature,

    // Sync
    isSyncingSettings: layout.isSyncing || aiConfig.isSyncing,
  }), [
    theme,
    layout,
    aiConfig,
    aiCredentials,
    setSectionVisibilityLegacy,
    setAiModel,
    setAiCredential,
  ]);

  return (
    <LegacySettingsContext.Provider value={value}>
      {children}
    </LegacySettingsContext.Provider>
  );
}

/**
 * SettingsProvider - Main settings provider
 * 
 * Wraps all settings contexts and provides both:
 * - New specialized hooks (useTheme, useAIConfig, useLayout)
 * - Legacy useSettings() hook for backward compatibility
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <ThemeProvider>
      <AIConfigProvider user={user}>
        <LayoutProvider user={user}>
          <LegacySettingsBridge>
            {children}
          </LegacySettingsBridge>
        </LayoutProvider>
      </AIConfigProvider>
    </ThemeProvider>
  );
}

/**
 * useSettings - Legacy hook for backward compatibility
 * 
 * @deprecated Use specialized hooks instead:
 * - useTheme() for theme/font preferences
 * - useAIConfig() for AI configuration
 * - useLayout() for layout preferences
 */
export function useSettings(): LegacySettingsContextType {
  const context = useContext(LegacySettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

// Type exports for consumers
export type { LLMProviderName };
