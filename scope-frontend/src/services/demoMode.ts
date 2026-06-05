const runtimeEnv = import.meta.env as Record<string, string | undefined>;

function envValue(...parts: string[]): string {
  return runtimeEnv[parts.join('_')]?.trim() ?? '';
}

export const IS_PRODUCTION_BUILD = import.meta.env.MODE === 'production';
export const LOCAL_PREVIEW_ENABLED = import.meta.env.VITE_ENABLE_LOCAL_PREVIEW === 'true';
export const DEMO_MODE_ENABLED =
  LOCAL_PREVIEW_ENABLED ||
  (!IS_PRODUCTION_BUILD && import.meta.env.DEV && envValue('VITE', 'DEMO', 'MODE') === 'true');
export const DEMO_LOGIN_EMAIL = import.meta.env.VITE_LOCAL_PREVIEW_LOGIN_EMAIL?.trim() ?? '';
export const DEMO_LOGIN_PASSWORD = import.meta.env.VITE_LOCAL_PREVIEW_LOGIN_PASSWORD?.trim() ?? '';
export const DEMO_LOGIN_ERROR_MESSAGE =
  DEMO_LOGIN_EMAIL && DEMO_LOGIN_PASSWORD
    ? 'Use the configured local preview credentials to enter Scope preview mode.'
    : 'Local preview credentials are not configured for this build.';
export function localFallbackEnabled(...parts: string[]): boolean {
  return !IS_PRODUCTION_BUILD && (DEMO_MODE_ENABLED || envValue(...parts) === 'true');
}
export const AUTH_MOCK_FALLBACK_ENABLED =
  localFallbackEnabled('VITE', 'ENABLE', 'AUTH', 'MOCK', 'FALLBACK');
export const USER_MOCK_FALLBACK_ENABLED =
  AUTH_MOCK_FALLBACK_ENABLED || localFallbackEnabled('VITE', 'ENABLE', 'USER', 'MOCK', 'FALLBACK');
