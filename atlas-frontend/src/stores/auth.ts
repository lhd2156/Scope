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
  const isAuthenticated = computed(() => Boolean(token.value) && Boolean(currentUser.value));
  let hydrationPromise: Promise<boolean> | null = null;

  function applyAuthPayload(payload: AuthPayload) {
    const sanitizedPayload = sanitizeAuthPayload(payload);
    token.value = sanitizedPayload.accessToken;
    currentUser.value = resolveCurrentUser(sanitizedPayload);
    hasSessionHint.value = true;
    hasHydratedSession.value = true;
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

  function updateCurrentUser(updates: Partial<UserProfile>) {
    if (!currentUser.value) {
      return;
    }

    currentUser.value = sanitizeUserProfile({
      ...currentUser.value,
      ...updates,
    });
  }

  async function refreshSession(options: { allowMockFallback?: boolean } = {}): Promise<string | null> {
    try {
      const payload = await refreshSessionRequest({
        allowMockFallback: options.allowMockFallback ?? Boolean(token.value),
      });
      applyAuthPayload(payload);
      return payload.accessToken;
    } catch {
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
        const restoredAccessToken = await refreshSession({ allowMockFallback: false });
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
    applyAuthPayload(await loginRequest(payload));
  }

  async function register(payload: RegisterForm) {
    applyAuthPayload(await registerRequest(payload));
  }

  async function loginWithCognito(idToken = 'demo-cognito-id-token') {
    applyAuthPayload(await loginWithCognitoRequest(idToken));
  }

  async function logout() {
    try {
      await logoutRequest();
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
    isAuthenticated,
    hydrateSession,
    login,
    register,
    loginWithCognito,
    refreshSession,
    updateCurrentUser,
    logout,
  };
});
