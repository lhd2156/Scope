import { defineStore } from 'pinia';
import { getCurrentUser, loginAdmin } from '@/api/core';
import { setStoredToken } from '@/api/client';
import type { UserProfile } from '@/types/user';
import { ADMIN_STORAGE_REFRESH_KEY, ADMIN_STORAGE_TOKEN_KEY } from '@/utils/constants';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  currentUser: UserProfile | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

function extractToken(payload: { accessToken?: string; access_token?: string; token?: string }): string {
  const token = payload.accessToken ?? payload.access_token ?? payload.token;
  if (!token) {
    throw new Error('Login response did not include an access token.');
  }
  return token;
}

function extractRefreshToken(payload: { refreshToken?: string; refresh_token?: string }): string | null {
  return payload.refreshToken ?? payload.refresh_token ?? null;
}

function isAdmin(user: UserProfile): boolean {
  const roles = [user.role, ...(user.roles ?? [])].filter(Boolean).map((role) => String(role).toLowerCase());
  return roles.includes('admin');
}

function persistTokens(token: string | null, refreshToken: string | null): void {
  setStoredToken(token);
  if (refreshToken) {
    localStorage.setItem(ADMIN_STORAGE_REFRESH_KEY, refreshToken);
    return;
  }
  localStorage.removeItem(ADMIN_STORAGE_REFRESH_KEY);
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem(ADMIN_STORAGE_TOKEN_KEY),
    refreshToken: localStorage.getItem(ADMIN_STORAGE_REFRESH_KEY),
    currentUser: null,
    loading: false,
    error: null,
    isAuthenticated: Boolean(localStorage.getItem(ADMIN_STORAGE_TOKEN_KEY)),
  }),
  actions: {
    async login(email: string, password: string) {
      this.loading = true;
      this.error = null;
      try {
        const auth = await loginAdmin({ email, password });
        const token = extractToken(auth);
        const refreshToken = extractRefreshToken(auth);
        persistTokens(token, refreshToken);

        const user = auth.user ?? (await getCurrentUser());
        if (!isAdmin(user)) {
          persistTokens(null, null);
          this.$patch({
            token: null,
            refreshToken: null,
            currentUser: null,
            isAuthenticated: false,
            loading: false,
            error: 'Access Denied',
          });
          throw new Error('Access Denied');
        }

        this.$patch({ token, refreshToken, currentUser: user, isAuthenticated: true, loading: false, error: null });
      } catch (error) {
        if ((error as Error).message !== 'Access Denied') {
          this.$patch({
            loading: false,
            error: error instanceof Error ? error.message : 'Login failed',
            token: null,
            refreshToken: null,
            currentUser: null,
            isAuthenticated: false,
          });
          persistTokens(null, null);
        }
        throw error;
      }
    },

    async hydrate() {
      const token = localStorage.getItem(ADMIN_STORAGE_TOKEN_KEY);
      if (!token) {
        this.$patch({ isAuthenticated: false, currentUser: null, token: null });
        return;
      }

      this.$patch({ loading: true, token, isAuthenticated: true });
      try {
        const user = await getCurrentUser();
        if (!isAdmin(user)) {
          this.logout();
          this.error = 'Access Denied';
          return;
        }
        this.$patch({ currentUser: user, loading: false, error: null });
      } catch (error) {
        this.logout();
        this.$patch({ loading: false, error: error instanceof Error ? error.message : 'Session expired' });
      }
    },

    refreshFromStorage() {
      const token = localStorage.getItem(ADMIN_STORAGE_TOKEN_KEY);
      const refreshToken = localStorage.getItem(ADMIN_STORAGE_REFRESH_KEY);
      this.$patch({ token, refreshToken, isAuthenticated: Boolean(token) });
    },

    logout() {
      persistTokens(null, null);
      this.$patch({ token: null, refreshToken: null, currentUser: null, isAuthenticated: false, loading: false });
    },

    clearError() {
      this.error = null;
    },
  },
});

export function installAuthUnauthorizedListener(): void {
  window.addEventListener('scope-admin-unauthorized', () => {
    useAuthStore().logout();
  });
}
