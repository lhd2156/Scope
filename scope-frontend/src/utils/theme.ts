import { readonly, ref } from 'vue';
import { trackThemeToggle } from '@/services/analyticsService';
import type { ThemeMode } from '@/types';
import { syncThemeColorMeta } from '@/utils/seo';

const STORAGE_KEY = 'scope-theme';
const activeTheme = ref<ThemeMode>('dark');
const THEMES = new Set<ThemeMode>(['dark', 'light']);

export interface ApplyThemeOptions {
  track?: boolean;
  source?: 'navbar' | 'settings';
  animate?: boolean;
}

export function getStoredTheme(): ThemeMode {
  try {
    const storedTheme = localStorage.getItem(STORAGE_KEY);
    return THEMES.has(storedTheme as ThemeMode) ? storedTheme as ThemeMode : 'dark';
  } catch {
    return 'dark';
  }
}

function commitThemeToDocument(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  syncThemeColorMeta(theme);
}

function applyDocumentTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }

  commitThemeToDocument(theme);
}

export function applyTheme(theme: ThemeMode, options: ApplyThemeOptions = {}): void {
  const nextTheme: ThemeMode = THEMES.has(theme) ? theme : 'dark';
  const previousTheme = activeTheme.value;
  const themeChanged = previousTheme !== nextTheme;

  activeTheme.value = nextTheme;

  applyDocumentTheme(nextTheme);

  try {
    localStorage.setItem(STORAGE_KEY, nextTheme);
  } catch {
    // Ignore storage write failures and keep the live document theme in sync.
  }

  if (options.track && options.source && themeChanged) {
    trackThemeToggle({
      theme: nextTheme,
      previousTheme,
      source: options.source,
      routeName: options.source === 'settings' ? 'settings' : undefined,
    });
  }
}

export function initializeTheme(): ThemeMode {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

export function toggleTheme(source: 'navbar' | 'settings' = 'navbar'): ThemeMode {
  const nextTheme: ThemeMode = activeTheme.value === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme, { animate: true, track: true, source });
  return nextTheme;
}

export function useTheme() {
  return readonly(activeTheme);
}
