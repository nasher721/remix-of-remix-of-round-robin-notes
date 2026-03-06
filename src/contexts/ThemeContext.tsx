import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { logError } from '@/lib/observability/logger';

/**
 * ThemeContext - Theme and visual preferences
 * 
 * Split from SettingsContext for better performance.
 * Components using this context only re-render when theme/font changes.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemePreferences {
  theme: ThemeMode;
  globalFontSize: number;
}

export interface ThemeContextValue extends ThemePreferences {
  setTheme: (theme: ThemeMode) => void;
  setGlobalFontSize: (size: number) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'rr-theme-preferences';

const DEFAULT_PREFERENCES: ThemePreferences = {
  theme: 'system',
  globalFontSize: 14,
};

function getInitialPreferences(): ThemePreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        theme: parsed.theme || DEFAULT_PREFERENCES.theme,
        globalFontSize: parsed.globalFontSize || DEFAULT_PREFERENCES.globalFontSize,
      };
    }
  } catch {
    // Ignore parsing errors
  }
  return DEFAULT_PREFERENCES;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<ThemePreferences>(getInitialPreferences);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const isDark = preferences.theme === 'dark' || 
      (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    root.classList.remove('light', 'dark');
    root.classList.add(isDark ? 'dark' : 'light');
  }, [preferences.theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (preferences.theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(mediaQuery.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preferences.theme]);

  // Persist preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      logError('Failed to save theme preferences', { source: 'ThemeContext' });
    }
  }, [preferences]);

  const setTheme = useCallback((theme: ThemeMode) => {
    setPreferences(prev => ({ ...prev, theme }));
  }, []);

  const setGlobalFontSize = useCallback((globalFontSize: number) => {
    setPreferences(prev => ({ ...prev, globalFontSize }));
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: preferences.theme,
    globalFontSize: preferences.globalFontSize,
    setTheme,
    setGlobalFontSize,
  }), [preferences.theme, preferences.globalFontSize, setTheme, setGlobalFontSize]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Convenience hook for just theme (avoids re-render on font size change)
export function useThemeOnly() {
  const { theme, setTheme } = useTheme();
  return { theme, setTheme };
}

// Convenience hook for just font size (avoids re-render on theme change)
export function useFontSize() {
  const { globalFontSize, setGlobalFontSize } = useTheme();
  return { globalFontSize, setGlobalFontSize };
}
