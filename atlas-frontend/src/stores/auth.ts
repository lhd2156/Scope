import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { clearApiSession, configureApiSessionHandlers, setAccessToken } from '@/services/api';
import {
  login as loginRequest,
  loginWithCognito as loginWithCognitoRequest,
  logout as logoutRequest,
  refreshSession as refreshSessionRequest,
  register as registerRequest,
} from '@/services/authService';
import { mockUsers } from '@/services/mockData';
import type { AuthForm, AuthPayload, RegisterForm, UserProfile } from '@/types';
import {
  clearStoredAuthSessionHint,
  hasStoredAuthSessionHint,
  persistAuthSessionHint,
  purgeLegacyAuthStorage,
} from '@/utils/authSessionStorage';
import { toAsyncErrorMessage } from '@/utils/errors';
import { sanitizeAuthPayload, sanitizeUserProfile } from '@/utils/sanitizers';

function resolveCurrentUser(payload: AuthPayload): UserProfile {
  const sanitizedPayload = sanitizeAuthPayload(payload);
  const matchingUser = mockUsers.find(
    (user) =>
      user.id === sanitizedPayload.id ||
      user.email === sanitizedPayload.email ||
      user.username === sanitizedPayload.username,
  );

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

export const useAuthStore = defineStore('auth', () => {
  purgeLegacyAuthStorage();

  const token = ref('');
  const currentUser = ref<UserProfile | null>(null);
  const hasSessionHint = ref(hasStoredAuthSessionHint());
  const isHydratingSession = ref(false);
  const hasHydratedSession = ref(false);
  const error = ref<string | null>(null);
  const isAuthenticated = computed(() => Boolean(token.value) && Boolean(currentUser.value));
  let hydrationPromise: Promise<boolean> | null = null;

  function applyAuthPayload(payload: AuthPayload) {
    const sanitizedPayload = sanitizeAuthPayload(payload);
    token.value = sanitizedPayload.accessToken;
    currentUser.value = resolveCurrentUser(sanitizedPayload);
    hasSessionHint.value = true;
    hasHydratedSession.value = true;
    error.value = null;
    persistAuthSessionHint();
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
    try {
      const payload = await refreshSessionRequest({
        allowMockFallback: options.allowMockFallback ?? Boolean(token.value),
      });
      applyAuthPayload(payload);
      return payload.accessToken;
    } catch (nextError) {
      if (options.captureError ?? true) {
        error.value = toAsyncErrorMessage(nextError, 'Atlas could not refresh your session right now.');
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
        const restoredAccessToken = await refreshSession({ allowMockFallback: false, captureError: false });
        return Boolean(restoredAccessToken);
      } finally {
        isHydratingSession.value = false;
        hasHydratedSession.value = true;
        hydrationPromise = null;
      }
    })();

    return hydrationPromise;
  }

  async function login(payload: AuthForm) {
    error.value = null;

    try {
      applyAuthPayload(await loginRequest(payload));
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Atlas could not sign you in right now.');
      throw nextError;
    }
  }

  async function register(payload: RegisterForm) {
    error.value = null;

    try {
      applyAuthPayload(await registerRequest(payload));
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Atlas could not create your account right now.');
      throw nextError;
    }
  }

  async function loginWithCognito(idToken = 'demo-cognito-id-token') {
    error.value = null;

    try {
      applyAuthPayload(await loginWithCognitoRequest(idToken));
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Atlas could not sign you in with Google right now.');
      throw nextError;
    }
  }

  async function logout() {
    error.value = null;

    try {
      await logoutRequest();
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Atlas could not reach logout services. You were signed out locally instead.');
    } finally {
      clearSession();
    }
  }

  configureApiSessionHandlers({
    refreshAccessToken: refreshSession,
    handleUnauthorized: clearSession,
  });

  return {
    token,
    currentUser,
    hasSessionHint,
    isHydratingSession,
    hasHydratedSession,
    error,
    isAuthenticated,
    hydrateSession,
    login,
    register,
    loginWithCognito,
    refreshSession,
    updateCurrentUser,
    clearError,
    logout,
  };
});
