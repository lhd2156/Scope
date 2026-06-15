import { computed, onScopeDispose, ref } from 'vue';
import { defineStore } from 'pinia';
import { AUTH_MOCK_FALLBACK_ENABLED } from '@/services/demoMode';
import { clearApiSession, configureApiSessionHandlers, isApiClientError, setAccessToken } from '@/services/api';
import type { AuthForm, AuthPayload, RegisterForm, UserProfile } from '@/types';
import {
  AUTH_SESSION_HINT_CHANGE_EVENT,
  clearStoredAuthSessionHint,
  hasStoredAuthSessionHint,
  persistAuthSessionHint,
  purgeLegacyAuthStorage,
  readStoredAuthSessionPersistence,
  readStoredRefreshToken,
  type AuthSessionPersistence,
} from '@/utils/authSessionStorage';
import { toAsyncErrorMessage } from '@/utils/errors';
import { getScopeQaSession } from '@/utils/qaMode';
import { sanitizeAuthPayload, sanitizeUserProfile } from '@/utils/sanitizers';

const INVALID_LOGIN_MESSAGE = 'Invalid username or password.';
const LOGIN_SERVICE_UNAVAILABLE_MESSAGE = 'Sign-in service is unavailable right now. Try again in a moment.';
const INVALID_LOGIN_STATUSES = new Set([400, 401, 403, 404, 422]);

async function resolveCurrentUser(payload: AuthPayload): Promise<UserProfile> {
  const sanitizedPayload = sanitizeAuthPayload(payload);
  const matchingUser = import.meta.env.MODE === 'production' && import.meta.env.VITE_ENABLE_LOCAL_PREVIEW !== 'true'
    ? undefined
    : (await import('@/services/mockAuthUsers')).findAuthMockUser({
      id: sanitizedPayload.id,
      email: sanitizedPayload.email,
      username: sanitizedPayload.username,
    });

  if (matchingUser) {
    return sanitizeUserProfile({
      ...matchingUser,
      username: sanitizedPayload.username || matchingUser.username,
      email: sanitizedPayload.email ?? matchingUser.email,
      displayName: sanitizedPayload.displayName ?? matchingUser.displayName,
    });
  }

  return sanitizeUserProfile({
    id: sanitizedPayload.id,
    username: sanitizedPayload.username,
    email: sanitizedPayload.email ?? '',
    displayName: sanitizedPayload.displayName ?? sanitizedPayload.username,
    avatarUrl: sanitizedPayload.avatarUrl,
    homeBase: sanitizedPayload.homeBase,
    interests: sanitizedPayload.interests ?? [],
    showActivityStatus: sanitizedPayload.showActivityStatus,
  });
}

async function loadAuthService() {
  return import('@/services/authService');
}

function resolveLoginErrorMessage(error: unknown): string {
  if (isApiClientError(error)) {
    if (error.status && INVALID_LOGIN_STATUSES.has(error.status)) {
      return INVALID_LOGIN_MESSAGE;
    }

    if (error.isNetworkError || (error.status && error.status >= 500)) {
      return LOGIN_SERVICE_UNAVAILABLE_MESSAGE;
    }

    return error.message || INVALID_LOGIN_MESSAGE;
  }

  if (error instanceof Error) {
    const message = error.message.trim();

    if (/status code (400|401|403|404|422)\b/i.test(message) || /invalid|credential|password|user/i.test(message)) {
      return INVALID_LOGIN_MESSAGE;
    }

    if (/status code 5\d\d\b|network|timeout|failed/i.test(message)) {
      return LOGIN_SERVICE_UNAVAILABLE_MESSAGE;
    }

    return message || INVALID_LOGIN_MESSAGE;
  }

  return INVALID_LOGIN_MESSAGE;
}

export const useAuthStore = defineStore('auth', () => {
  purgeLegacyAuthStorage();

  const token = ref('');
  const currentUser = ref<UserProfile | null>(null);
  const hasSessionHint = ref(hasStoredAuthSessionHint() || getScopeQaSession() === 'authenticated');
  const isHydratingSession = ref(false);
  const hasHydratedSession = ref(false);
  const error = ref<string | null>(null);
  const sessionExpiredMessage = ref<string | null>(null);
  const isAuthenticated = computed(() => Boolean(token.value) && Boolean(currentUser.value));
  let hydrationPromise: Promise<boolean> | null = null;

  function syncStoredSessionHint() {
    const nextHasSessionHint = hasStoredAuthSessionHint() || getScopeQaSession() === 'authenticated';
    hasSessionHint.value = nextHasSessionHint;

    if (isAuthenticated.value) {
      return;
    }

    hasHydratedSession.value = !nextHasSessionHint;
    if (nextHasSessionHint) {
      error.value = null;
      sessionExpiredMessage.value = null;
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener(AUTH_SESSION_HINT_CHANGE_EVENT, syncStoredSessionHint);
    onScopeDispose(() => {
      window.removeEventListener(AUTH_SESSION_HINT_CHANGE_EVENT, syncStoredSessionHint);
    });
  }

  function applyQaAuthenticatedSession(): string {
    const nextToken = token.value || (() => {
      // QA mode is gated on isQaModeAllowed() in utils/qaMode.ts — this value
      // never ships in a production bundle. Randomise it anyway so it is not
      // a stable string an attacker could target in mixed-environment setups.
      const buf = typeof crypto !== 'undefined' && crypto.getRandomValues
        ? Array.from(crypto.getRandomValues(new Uint32Array(4))).map((n) => n.toString(16)).join('')
        : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
      return `scope-qa-${buf}`;
    })();

    token.value = nextToken;
    currentUser.value = sanitizeUserProfile({
      id: currentUser.value?.id ?? 'user-1',
      username: currentUser.value?.username ?? 'scope-qa',
      email: currentUser.value?.email ?? '',
      displayName: currentUser.value?.displayName ?? 'Scope traveler',
      avatarUrl: currentUser.value?.avatarUrl,
      bio: currentUser.value?.bio,
      homeBase: currentUser.value?.homeBase,
      interests: currentUser.value?.interests ?? ['food', 'culture', 'nightlife'],
      stats: currentUser.value?.stats ?? { spots: 42, trips: 8, friends: 126 },
    });
    hasSessionHint.value = true;
    hasHydratedSession.value = true;
    error.value = null;
    sessionExpiredMessage.value = null;
    persistAuthSessionHint();
    setAccessToken(nextToken);
    return nextToken;
  }

  async function applyAuthPayload(payload: AuthPayload, persistence: AuthSessionPersistence = 'session') {
    const sanitizedPayload = sanitizeAuthPayload(payload);
    token.value = sanitizedPayload.accessToken;
    currentUser.value = await resolveCurrentUser(sanitizedPayload);
    hasSessionHint.value = true;
    hasHydratedSession.value = true;
    error.value = null;
    sessionExpiredMessage.value = null;
    persistAuthSessionHint(sanitizedPayload.refreshToken, { persistence });
    setAccessToken(token.value);
  }

  function clearSession() {
    token.value = '';
    currentUser.value = null;
    hasSessionHint.value = false;
    hasHydratedSession.value = true;
    clearStoredAuthSessionHint();
    clearApiSession();
  }

  function clearError() {
    error.value = null;
  }

  function clearSessionExpiredMessage() {
    sessionExpiredMessage.value = null;
  }

  function updateCurrentUser(updates: Partial<UserProfile>) {
    if (!currentUser.value) {
      return;
    }

    currentUser.value = sanitizeUserProfile({
      ...currentUser.value,
      ...updates,
    });
  }

  async function refreshSession(options: { allowMockFallback?: boolean; captureError?: boolean } = {}): Promise<string | null> {
    if (getScopeQaSession() === 'authenticated') {
      return applyQaAuthenticatedSession();
    }

    try {
      const { refreshSession: refreshSessionRequest } = await loadAuthService();
      const payload = await refreshSessionRequest({
        allowMockFallback: options.allowMockFallback ?? Boolean(token.value),
      });
      await applyAuthPayload(payload, readStoredAuthSessionPersistence());
      return payload.accessToken;
    } catch (nextError) {
      if (options.captureError ?? true) {
        error.value = toAsyncErrorMessage(nextError, 'Scope could not refresh your session right now.');
      }
      clearSession();
      return null;
    }
  }

  async function hydrateSession(): Promise<boolean> {
    if (hydrationPromise) {
      return hydrationPromise;
    }

    if (isAuthenticated.value) {
      hasHydratedSession.value = true;
      return true;
    }

    if (!hasSessionHint.value) {
      hasHydratedSession.value = true;
      return false;
    }

    hydrationPromise = (async () => {
      isHydratingSession.value = true;

      try {
        const restoredAccessToken = await refreshSession({
          allowMockFallback: AUTH_MOCK_FALLBACK_ENABLED || getScopeQaSession() === 'authenticated',
          captureError: false,
        });
        return Boolean(restoredAccessToken);
      } finally {
        isHydratingSession.value = false;
        hasHydratedSession.value = true;
        hydrationPromise = null;
      }
    })();

    return hydrationPromise;
  }

  function handleSessionExpired(message = 'Your session expired. Sign in again to keep planning in Scope.') {
    if (getScopeQaSession() === 'authenticated') {
      applyQaAuthenticatedSession();
      return;
    }

    clearSession();
    error.value = null;
    sessionExpiredMessage.value = message;
  }

  async function login(payload: AuthForm) {
    error.value = null;
    sessionExpiredMessage.value = null;

    try {
      const { login: loginRequest } = await loadAuthService();
      await applyAuthPayload(await loginRequest(payload), payload.rememberMe ? 'local' : 'session');
    } catch (nextError) {
      error.value = resolveLoginErrorMessage(nextError);
      throw nextError;
    }
  }

  async function register(payload: RegisterForm) {
    error.value = null;
    sessionExpiredMessage.value = null;

    try {
      const { register: registerRequest } = await loadAuthService();
      await applyAuthPayload(await registerRequest(payload));
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not create your account right now.');
      throw nextError;
    }
  }

  async function loginWithCognito(idToken = '') {
    error.value = null;
    sessionExpiredMessage.value = null;

    try {
      if (!idToken.trim()) {
        throw new Error('Google sign-in is not configured for this build.');
      }
      const { loginWithCognito: loginWithCognitoRequest } = await loadAuthService();
      await applyAuthPayload(await loginWithCognitoRequest(idToken));
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not sign you in with Google right now.');
      throw nextError;
    }
  }

  async function logout() {
    error.value = null;
    sessionExpiredMessage.value = null;
    const refreshToken = readStoredRefreshToken();
    clearSession();

    try {
      const { logout: logoutRequest } = await loadAuthService();
      await logoutRequest(refreshToken);
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not reach logout services. You were signed out locally instead.');
    }
  }

  configureApiSessionHandlers({
    refreshAccessToken: refreshSession,
    handleUnauthorized: handleSessionExpired,
  });

  return {
    token,
    currentUser,
    hasSessionHint,
    isHydratingSession,
    hasHydratedSession,
    error,
    sessionExpiredMessage,
    isAuthenticated,
    hydrateSession,
    login,
    register,
    loginWithCognito,
    refreshSession,
    updateCurrentUser,
    clearError,
    clearSessionExpiredMessage,
    logout,
  };
});
