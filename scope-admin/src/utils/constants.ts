export const ADMIN_STORAGE_TOKEN_KEY = 'scope-admin-token';
export const ADMIN_STORAGE_REFRESH_KEY = 'scope-admin-refresh-token';
export const ADMIN_STORAGE_THEME_KEY = 'scope-admin-theme';
export const DEFAULT_PAGE_SIZE = 25;

export const navItems = [
  { label: 'Dashboard', path: '/dashboard', glyph: 'DB' },
  { label: 'Users', path: '/users', glyph: 'US' },
  { label: 'Spots', path: '/spots', glyph: 'SP' },
  { label: 'Trips', path: '/trips', glyph: 'TR' },
  { label: 'Reviews', path: '/reviews', glyph: 'RV' },
  { label: 'Photos', path: '/photos', glyph: 'PH' },
  { label: 'Analytics', path: '/analytics', glyph: 'AN' },
  { label: 'Settings', path: '/settings', glyph: 'SE' },
] as const;

export const environmentRows = [
  ['API base URL', import.meta.env.VITE_API_BASE_URL ?? '/'],
  ['Admin base path', import.meta.env.VITE_ADMIN_BASE_PATH ?? '/admin/'],
  ['Environment', import.meta.env.VITE_ADMIN_ENV ?? import.meta.env.MODE],
  ['Mapbox configured', import.meta.env.VITE_MAPBOX_TOKEN ? 'Yes' : 'No'],
] as const;
