export const APP_THEMES = ['system', 'dark', 'light'] as const;
export type AppTheme = (typeof APP_THEMES)[number];

export const BOARD_SKINS = ['auto', 'classic', 'green', 'graphite', 'sand', 'cherry', 'ocean', 'marble'] as const;
export type BoardSkin = (typeof BOARD_SKINS)[number];

export interface AppPreferences {
  theme: AppTheme;
  /** `auto` keeps the board in the same visual family as the resolved app theme. */
  boardSkin: BoardSkin;
}

const STORAGE_KEY = 'draughts-corpus-engine:preferences:v2';
const LEGACY_STORAGE_KEY = 'draughts-corpus-engine:preferences:v1';

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'system',
  boardSkin: 'auto',
};

export function loadPreferences(): AppPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
      ?? '{}';
    return sanitizePreferences(JSON.parse(raw) as Partial<AppPreferences>);
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

export function resolvedTheme(preferences = loadPreferences()): Exclude<AppTheme, 'system'> {
  if (preferences.theme !== 'system') return preferences.theme;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyPreferences(preferences = loadPreferences()): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme(preferences);
  root.dataset.themePreference = preferences.theme;
  root.dataset.board = preferences.boardSkin;
  root.style.colorScheme = preferences.theme === 'system' ? 'light dark' : preferences.theme;
}

/**
 * Keeps `theme: system` live when Android/browser appearance changes while the
 * application is already open. Returns a cleanup function for React effects.
 */
export function watchSystemAppearance(onChange?: (preferences: AppPreferences) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    const preferences = loadPreferences();
    if (preferences.theme !== 'system') return;
    applyPreferences(preferences);
    onChange?.(preferences);
  };
  media.addEventListener?.('change', handleChange);
  return () => media.removeEventListener?.('change', handleChange);
}

function sanitizePreferences(value: Partial<AppPreferences>): AppPreferences {
  return {
    theme: APP_THEMES.includes(value.theme as AppTheme) ? value.theme as AppTheme : DEFAULT_PREFERENCES.theme,
    boardSkin: BOARD_SKINS.includes(value.boardSkin as BoardSkin) ? value.boardSkin as BoardSkin : DEFAULT_PREFERENCES.boardSkin,
  };
}
