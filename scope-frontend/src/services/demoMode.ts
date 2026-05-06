export const DEMO_MODE_ENABLED = import.meta.env.VITE_DEMO_MODE === 'true';
export const DEMO_LOGIN_EMAIL = 'demo@scope.travel';
export const DEMO_LOGIN_PASSWORD = 'Scope2024!';
export const DEMO_LOGIN_ERROR_MESSAGE = `Use ${DEMO_LOGIN_EMAIL} / ${DEMO_LOGIN_PASSWORD} to enter Scope demo mode.`;
export const AUTH_MOCK_FALLBACK_ENABLED = DEMO_MODE_ENABLED || import.meta.env.VITE_ENABLE_AUTH_MOCK_FALLBACK === 'true';
export const USER_MOCK_FALLBACK_ENABLED =
  DEMO_MODE_ENABLED ||
  import.meta.env.VITE_ENABLE_USER_MOCK_FALLBACK === 'true' ||
  AUTH_MOCK_FALLBACK_ENABLED;
