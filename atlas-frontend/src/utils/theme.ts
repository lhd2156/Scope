import { readonly, ref } from 'vue';
import type { ThemeMode } from '@/types';
import { syncThemeColorMeta } from '@/utils/seo';

const STORAGE_KEY = 'atlas-theme';
const activeTheme = ref<ThemeMode>('dark');

export interface ApplyThemeOptions {
  track?: boolean;
  source?: 'navbar' | 'settings';
}

export function getStoredTheme(): ThemeMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: ThemeMode, options: ApplyThemeOptions = {}): void {
  const previousTheme = activeTheme.value;
  const themeChanged = previousTheme !== theme;

  activeTheme.value = theme;

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    syncThemeColorMeta(theme);
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage write failures and keep the live document theme in sync.
  }

  if (options.track && options.source && themeChanged) {
    void import('@/services/analyticsService')
      .then(({ trackThemeToggle }) => {
        trackThemeToggle({
          theme,
          previousTheme,
          source: options.source,
          routeName: options.source === 'settings' ? 'settings' : undefined,
        });
      })
      .catch(() => undefined);
  }
}

export function initializeTheme(): ThemeMode {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

export function toggleTheme(source: 'navbar' | 'settings' = 'navbar'): ThemeMode {
  const nextTheme: ThemeMode = activeTheme.value === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme, { track: true, source });
  return nextTheme;
}

export function useTheme() {
  return readonly(activeTheme);
}
