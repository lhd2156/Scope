import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCurrentUser, loginAdmin } from '@/api/core';
import { installAuthUnauthorizedListener, useAuthStore } from '@/stores/authStore';
import { ADMIN_STORAGE_REFRESH_KEY, ADMIN_STORAGE_TOKEN_KEY } from '@/utils/constants';

vi.mock('@/api/core', () => ({
  loginAdmin: vi.fn(),
  getCurrentUser: vi.fn(),
}));

const adminUser = {
  id: 'admin-1',
  username: 'admin',
  email: 'admin@scope.local',
  role: 'admin',
};

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore().$patch({
      token: null,
      refreshToken: null,
      currentUser: null,
      loading: false,
      error: null,
      isAuthenticated: false,
    });
  });

  it('logs in admin users and persists tokens', async () => {
    vi.mocked(loginAdmin).mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);

    const store = useAuthStore();
    await store.login('admin@scope.local', 'password');

    expect(store.isAuthenticated).toBe(true);
    expect(sessionStorage.getItem(ADMIN_STORAGE_TOKEN_KEY)).toBe('access');
    expect(sessionStorage.getItem(ADMIN_STORAGE_REFRESH_KEY)).toBe('refresh');
  });

  it('accepts token aliases and embedded admin users', async () => {
    vi.mocked(loginAdmin).mockResolvedValue({
      access_token: 'access-alias',
      refresh_token: 'refresh-alias',
      user: { ...adminUser, role: undefined, roles: ['moderator', 'ADMIN'] },
    });

    const store = useAuthStore();
    await store.login('admin@scope.local', 'password');

    expect(store.token).toBe('access-alias');
    expect(store.refreshToken).toBe('refresh-alias');
    expect(vi.mocked(getCurrentUser)).not.toHaveBeenCalled();
  });

  it('records failed login errors and clears them on demand', async () => {
    vi.mocked(loginAdmin).mockRejectedValue('network down');

    const store = useAuthStore();
    await expect(store.login('admin@scope.local', 'password')).rejects.toBe('network down');

    expect(store.error).toBe('Login failed');
    store.clearError();
    expect(store.error).toBeNull();
  });

  it('rejects login payloads without any access token shape', async () => {
    vi.mocked(loginAdmin).mockResolvedValue({});

    const store = useAuthStore();
    await expect(store.login('admin@scope.local', 'password')).rejects.toThrow(
      'Login response did not include an access token.',
    );

    expect(store.error).toBe('Login response did not include an access token.');
    expect(store.isAuthenticated).toBe(false);
  });

  it('accepts the legacy token shape and clears an omitted refresh token', async () => {
    sessionStorage.setItem(ADMIN_STORAGE_REFRESH_KEY, 'stale-refresh');
    vi.mocked(loginAdmin).mockResolvedValue({
      token: 'legacy-access',
      user: adminUser,
    });

    const store = useAuthStore();
    await store.login('admin@scope.local', 'password');

    expect(store.token).toBe('legacy-access');
    expect(store.refreshToken).toBeNull();
    expect(sessionStorage.getItem(ADMIN_STORAGE_REFRESH_KEY)).toBeNull();
  });

  it('rejects non-admin users', async () => {
    vi.mocked(loginAdmin).mockResolvedValue({ accessToken: 'access' });
    vi.mocked(getCurrentUser).mockResolvedValue({ ...adminUser, role: 'user' });

    const store = useAuthStore();
    await expect(store.login('user@scope.local', 'password')).rejects.toThrow('Access Denied');

    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem(ADMIN_STORAGE_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(ADMIN_STORAGE_TOKEN_KEY)).toBeNull();
  });

  it('hydrates an existing admin session', async () => {
    sessionStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, 'stored');
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);

    const store = useAuthStore();
    await store.hydrate();

    expect(store.currentUser?.id).toBe('admin-1');
  });

  it('handles empty, denied, and expired hydration states', async () => {
    const store = useAuthStore();
    await store.hydrate();
    expect(store.isAuthenticated).toBe(false);

    sessionStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, 'stored');
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ ...adminUser, role: 'user', roles: [] });
    await store.hydrate();
    expect(store.error).toBe('Access Denied');
    expect(store.isAuthenticated).toBe(false);

    sessionStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, 'stored');
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('expired'));
    await store.hydrate();
    expect(store.error).toBe('expired');
    expect(store.isAuthenticated).toBe(false);

    sessionStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, 'stored');
    vi.mocked(getCurrentUser).mockRejectedValueOnce('offline');
    await store.hydrate();
    expect(store.error).toBe('Session expired');
    expect(store.isAuthenticated).toBe(false);
  });

  it('logs out and clears tokens', () => {
    sessionStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, 'stored');
    const store = useAuthStore();
    store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem(ADMIN_STORAGE_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(ADMIN_STORAGE_TOKEN_KEY)).toBeNull();
  });

  it('refreshes token state from sessionStorage', () => {
    sessionStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, 'stored');
    sessionStorage.setItem(ADMIN_STORAGE_REFRESH_KEY, 'refresh');

    const store = useAuthStore();
    store.refreshFromStorage();

    expect(store.token).toBe('stored');
    expect(store.refreshToken).toBe('refresh');
  });

  it('logs out through the unauthorized browser event listener', () => {
    const store = useAuthStore();
    store.$patch({ token: 'token', isAuthenticated: true });

    installAuthUnauthorizedListener();
    window.dispatchEvent(new CustomEvent('scope-admin-unauthorized'));

    expect(store.isAuthenticated).toBe(false);
    expect(store.token).toBeNull();
  });
});
