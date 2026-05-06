import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { clearApiSession, configureApiSessionHandlers, setAccessToken } from '@/services/api';
import type { AuthForm, AuthPayload, RegisterForm, UserProfile } from '@/types';
import {
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

async function resolveCurrentUser(payload: AuthPayload): Promise<UserProfile> {
  const sanitizedPayload = sanitizeAuthPayload(payload);
  const { findAuthMockUser } = await import('@/services/mockAuthUsers');
  const matchingUser = findAuthMockUser({
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
    interests: [],
  });
}

async function loadAuthService() {
  return import('@/services/authService');
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
      username: currentUser.value?.username ?? 'scopedemo',
      email: currentUser.value?.email ?? 'demo@scope.travel',
      displayName: currentUser.value?.displayName ?? 'Local preview user',
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
          allowMockFallback: getScopeQaSession() === 'authenticated',
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
      error.value = toAsyncErrorMessage(nextError, 'Scope could not sign you in right now.');
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

  async function loginWithCognito(idToken = 'demo-cognito-id-token') {
    error.value = null;
    sessionExpiredMessage.value = null;

    try {
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

    try {
      const { logout: logoutRequest } = await loadAuthService();
      await logoutRequest(refreshToken);
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not reach logout services. You were signed out locally instead.');
    } finally {
      clearSession();
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
