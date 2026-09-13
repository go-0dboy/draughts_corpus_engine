export const APP_THEMES = ['system', 'dark', 'light'] as const;
export type AppTheme = (typeof APP_THEMES)[number];

export const BOARD_SKINS = ['classic', 'green', 'graphite', 'sand', 'cherry', 'ocean', 'marble'] as const;
export type BoardSkin = (typeof BOARD_SKINS)[number];

export interface AppPreferences {
  theme: AppTheme;
  boardSkin: BoardSkin;
}

const STORAGE_KEY = 'draughts-corpus-engine:preferences:v1';

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'system',
  boardSkin: 'classic',
};

export function loadPreferences(): AppPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<AppPreferences>;
    return sanitizePreferences(value);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(patch: Partial<AppPreferences>): AppPreferences {
  const next = sanitizePreferences({ ...loadPreferences(), ...patch });
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
  }
  applyPreferences(next);
  return next;
}

export function applyPreferences(preferences = loadPreferences()): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.board = preferences.boardSkin;

  if (preferences.theme === 'system') {
    const dark = typeof window === 'undefined' || !window.matchMedia
      ? true
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.themePreference = 'system';
  } else {
    root.dataset.theme = preferences.theme;
    root.dataset.themePreference = preferences.theme;
  }
}

function sanitizePreferences(value: Partial<AppPreferences>): AppPreferences {
  return {
    theme: APP_THEMES.includes(value.theme as AppTheme) ? value.theme as AppTheme : DEFAULT_PREFERENCES.theme,
    boardSkin: BOARD_SKINS.includes(value.boardSkin as BoardSkin) ? value.boardSkin as BoardSkin : DEFAULT_PREFERENCES.boardSkin,
  };
}
