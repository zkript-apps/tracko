'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authClient, useSession } from '@/lib/auth-client';
import {
  applyThemeMode,
  DEFAULT_THEME_MODE,
  normalizeThemeMode,
  readStoredThemeMode,
  type ThemeMode,
} from '@/lib/theme';

type ThemeContextValue = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isSaving: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const stored = readStoredThemeMode();
    setThemeModeState(stored);
    applyThemeMode(stored);
  }, []);

  useEffect(() => {
    const userTheme = (session?.user as { themeMode?: string } | undefined)
      ?.themeMode;
    if (!userTheme) {
      return;
    }

    const next = normalizeThemeMode(userTheme);
    setThemeModeState(next);
    applyThemeMode(next);
  }, [session?.user]);

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      const next = normalizeThemeMode(mode);
      setThemeModeState(next);
      applyThemeMode(next);

      if (!session?.user) {
        return;
      }

      setIsSaving(true);
      try {
        await authClient.updateUser({
          themeMode: next,
        });
      } finally {
        setIsSaving(false);
      }
    },
    [session?.user],
  );

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      isSaving,
    }),
    [themeMode, setThemeMode, isSaving],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider.');
  }

  return context;
}
