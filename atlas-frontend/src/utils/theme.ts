import type { ThemeMode } from '@/types';

const STORAGE_KEY = 'atlas-theme';

export function getStoredTheme(): ThemeMode {
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}
