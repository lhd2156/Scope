import { ADMIN_STORAGE_THEME_KEY } from '@/utils/constants';

export type AdminTheme = 'dark' | 'light';

function applyTheme(theme: AdminTheme) {
  document.documentElement.classList.toggle('light', theme === 'light');
}

export function getStoredTheme(): AdminTheme {
  return localStorage.getItem(ADMIN_STORAGE_THEME_KEY) === 'light' ? 'light' : 'dark';
}

export function initTheme(): AdminTheme {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

export function setTheme(theme: AdminTheme) {
  localStorage.setItem(ADMIN_STORAGE_THEME_KEY, theme);
  applyTheme(theme);
}
