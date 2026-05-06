import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCurrentUser, loginAdmin } from '@/api/core';
import { useAuthStore } from '@/stores/authStore';
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
    expect(localStorage.getItem(ADMIN_STORAGE_TOKEN_KEY)).toBe('access');
    expect(localStorage.getItem(ADMIN_STORAGE_REFRESH_KEY)).toBe('refresh');
  });

  it('rejects non-admin users', async () => {
    vi.mocked(loginAdmin).mockResolvedValue({ accessToken: 'access' });
    vi.mocked(getCurrentUser).mockResolvedValue({ ...adminUser, role: 'user' });

    const store = useAuthStore();
    await expect(store.login('user@scope.local', 'password')).rejects.toThrow('Access Denied');

    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem(ADMIN_STORAGE_TOKEN_KEY)).toBeNull();
  });

  it('hydrates an existing admin session', async () => {
    localStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, 'stored');
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);

    const store = useAuthStore();
    await store.hydrate();

    expect(store.currentUser?.id).toBe('admin-1');
  });

  it('logs out and clears tokens', () => {
    localStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, 'stored');
    const store = useAuthStore();
    store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem(ADMIN_STORAGE_TOKEN_KEY)).toBeNull();
  });

  it('refreshes token state from localStorage', () => {
    localStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, 'stored');
    localStorage.setItem(ADMIN_STORAGE_REFRESH_KEY, 'refresh');

    const store = useAuthStore();
    store.refreshFromStorage();

    expect(store.token).toBe('stored');
    expect(store.refreshToken).toBe('refresh');
  });
});
