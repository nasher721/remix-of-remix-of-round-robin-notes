/**
 * Hook for managing customizable systems review sections
 * Persists configuration to localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import { safeLocalStorage } from '@/utils/safeStorage';
import { SYSTEM_ICONS, SYSTEM_KEYS, SYSTEM_LABELS } from '@/constants/systems';

export interface SystemConfig {
  key: string;
  label: string;
  shortLabel: string;
  icon: string;
  enabled: boolean;
  sortOrder: number;
  isCustom: boolean;
}

// Default systems that ship with the app
export const DEFAULT_SYSTEMS: SystemConfig[] = SYSTEM_KEYS.map((key, sortOrder) => ({
  key, label: SYSTEM_LABELS[key], shortLabel: SYSTEM_LABELS[key], icon: SYSTEM_ICONS[key],
  enabled: true, sortOrder, isCustom: false,
}));

const LEGACY_LABELS: Record<string, string[]> = {
  neuro: ['Neuro'], cv: ['Cardiovascular', 'CV'], resp: ['Respiratory', 'Resp'],
  renalGU: ['Renal/GU'], gi: ['GI/Nutrition', 'GI'], endo: ['Endocrine', 'Endo'],
  heme: ['Hematology', 'Heme'], infectious: ['Infectious', 'ID'],
  skinLines: ['Skin/Lines'], dispo: ['Disposition', 'Dispo'],
};

/** Upgrade old default titles while retaining custom labels and visibility preferences. */
export function mergeSystemsConfig(saved: SystemConfig[]): SystemConfig[] {
  const merged = [...saved].sort((a, b) => a.sortOrder - b.sortOrder).map((system) => {
    if (system.isCustom || !LEGACY_LABELS[system.key]?.includes(system.label)) return { ...system };
    return { ...system, label: SYSTEM_LABELS[system.key], shortLabel: SYSTEM_LABELS[system.key] };
  });
  DEFAULT_SYSTEMS.forEach((system) => {
    if (merged.some((existing) => existing.key === system.key)) return;
    const linesIndex = merged.findIndex((existing) => existing.key === 'skinLines');
    if (system.key === 'skin' && linesIndex !== -1) merged.splice(linesIndex + 1, 0, { ...system });
    else merged.push({ ...system });
  });
  return merged.map((system, sortOrder) => ({ ...system, sortOrder }));
}

const STORAGE_KEY = 'handoff-systems-config';

export const useSystemsConfig = () => {
  const [systems, setSystems] = useState<SystemConfig[]>(() => {
    try {
      const saved = safeLocalStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return mergeSystemsConfig(parsed);
      }
    } catch (e) {
      console.error('Failed to load systems config:', e);
    }
    return DEFAULT_SYSTEMS;
  });

  // Persist to localStorage when systems change
  useEffect(() => {
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(systems));
  }, [systems]);

  // Get only enabled systems, sorted
  const enabledSystems = systems
    .filter((s) => s.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Get labels map for compatibility with existing code
  const systemLabels = systems.reduce((acc, s) => {
    if (s.enabled) acc[s.key] = s.label;
    return acc;
  }, {} as Record<string, string>);

  const systemLabelsShort = systems.reduce((acc, s) => {
    if (s.enabled) acc[s.key] = s.shortLabel;
    return acc;
  }, {} as Record<string, string>);

  const systemIcons = systems.reduce((acc, s) => {
    if (s.enabled) acc[s.key] = s.icon;
    return acc;
  }, {} as Record<string, string>);

  // Toggle a system on/off
  const toggleSystem = useCallback((key: string) => {
    setSystems((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))
    );
  }, []);

  // Update a system's properties
  const updateSystem = useCallback((key: string, updates: Partial<SystemConfig>) => {
    setSystems((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...updates } : s))
    );
  }, []);

  // Add a new custom system
  const addSystem = useCallback((config: Omit<SystemConfig, 'sortOrder' | 'isCustom'>) => {
    setSystems((prev) => {
      // Generate a unique key if not provided or if it conflicts
      let key = config.key || config.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      const existingKeys = new Set(prev.map((s) => s.key));
      let counter = 1;
      while (existingKeys.has(key)) {
        key = `${config.key || config.label.toLowerCase().replace(/[^a-z0-9]/g, '')}_${counter}`;
        counter++;
      }

      const newSystem: SystemConfig = {
        ...config,
        key,
        sortOrder: prev.length,
        isCustom: true,
      };
      return [...prev, newSystem];
    });
  }, []);

  // Remove a custom system
  const removeSystem = useCallback((key: string) => {
    setSystems((prev) => prev.filter((s) => s.key !== key || !s.isCustom));
  }, []);

  // Reorder systems
  const reorderSystems = useCallback((fromIndex: number, toIndex: number) => {
    setSystems((prev) => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result.map((s, i) => ({ ...s, sortOrder: i }));
    });
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSystems(DEFAULT_SYSTEMS);
  }, []);

  return {
    systems,
    enabledSystems,
    systemLabels,
    systemLabelsShort,
    systemIcons,
    toggleSystem,
    updateSystem,
    addSystem,
    removeSystem,
    reorderSystems,
    resetToDefaults,
  };
};
