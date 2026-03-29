import { readonly, ref } from 'vue';
import type { ThemeMode } from '@/types';

const STORAGE_KEY = 'atlas-theme';
const activeTheme = ref<ThemeMode>('dark');

export function getStoredTheme(): ThemeMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: ThemeMode): void {
  activeTheme.value = theme;

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage write failures and keep the live document theme in sync.
  }
}

export function initializeTheme(): ThemeMode {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

export function toggleTheme(): ThemeMode {
  const nextTheme: ThemeMode = activeTheme.value === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  return nextTheme;
}

export function useTheme() {
  return readonly(activeTheme);
}
