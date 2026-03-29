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
  const token = ref('');
  const refreshToken = ref('');
  const currentUser = ref<UserProfile | null>(null);
  const isAuthenticated = computed(() => Boolean(token.value || currentUser.value));

  function applyAuthPayload(payload: AuthPayload) {
    const sanitizedPayload = sanitizeAuthPayload(payload);
    token.value = sanitizedPayload.accessToken;
    refreshToken.value = sanitizedPayload.refreshToken;
    currentUser.value = resolveCurrentUser(sanitizedPayload);
    setAccessToken(token.value);
  }

  function clearSession() {
    token.value = '';
    refreshToken.value = '';
    currentUser.value = null;
    clearApiSession();
    setAccessToken('');
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

  async function refreshSession(): Promise<string | null> {
    if (!currentUser.value) {
      clearSession();
      return null;
    }

    const payload = await refreshSessionRequest(refreshToken.value);
    applyAuthPayload(payload);
    return payload.accessToken;
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
    refreshToken,
    currentUser,
    isAuthenticated,
    login,
    register,
    loginWithCognito,
    refreshSession,
    updateCurrentUser,
    logout,
  };
});
