export const THEME_MODES = ['dark', 'light'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export const DEFAULT_THEME_MODE: ThemeMode = 'dark';

export const THEME_MODE_STORAGE_KEY = 'tracko:theme-mode';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light';
}

export function normalizeThemeMode(value: unknown): ThemeMode {
  return isThemeMode(value) ? value : DEFAULT_THEME_MODE;
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;

  if (mode === 'light') {
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
  }

  root.dataset.theme = mode;

  try {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures.
  }
}

export function readStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_MODE;
  }

  try {
    return normalizeThemeMode(window.localStorage.getItem(THEME_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

/** Inline script to avoid flash of wrong theme before React hydrates. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_MODE_STORAGE_KEY}');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.dataset.theme='light';}else{document.documentElement.classList.add('dark');document.documentElement.dataset.theme='dark';}}catch(e){document.documentElement.classList.add('dark');document.documentElement.dataset.theme='dark';}})();`;
