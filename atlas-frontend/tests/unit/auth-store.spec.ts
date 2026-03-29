import { createPinia, setActivePinia } from 'pinia';

const AUTH_SESSION_HINT_STORAGE_KEY = 'atlas-auth-session-hint';

async function bootstrapAuthStore() {
  setActivePinia(createPinia());
  const { useAuthStore } = await import('@/stores/auth');
  return useAuthStore();
}

describe('auth store security hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.doUnmock('@/services/authService');
    localStorage.clear();
    sessionStorage.clear();
  });

  it('persists only a safe session hint after login', async () => {
    const loginRequest = vi.fn().mockResolvedValue({
      id: 'user-2',
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
      accessToken: 'secret-access-token',
      refreshToken: 'secret-refresh-token',
    });

    vi.doMock('@/services/authService', () => ({
      login: loginRequest,
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    }));

    const store = await bootstrapAuthStore();
    await store.login({
      email: 'maya@example.com',
      password: 'SecurePass123!',
    });

    const storedHint = localStorage.getItem(AUTH_SESSION_HINT_STORAGE_KEY);

    expect(loginRequest).toHaveBeenCalledTimes(1);
    expect(store.token).toBe('secret-access-token');
    expect(store.isAuthenticated).toBe(true);
    expect(storedHint).toBeTruthy();
    expect(storedHint).not.toContain('secret-access-token');
    expect(storedHint).not.toContain('secret-refresh-token');
    expect(JSON.parse(storedHint ?? '{}')).toMatchObject({
      version: 1,
      hasSessionCookie: true,
    });
  });

  it('purges legacy Atlas token keys during store bootstrap', async () => {
    localStorage.setItem('atlas.auth.accessToken', 'legacy-access-token');
    localStorage.setItem('atlas.auth.refreshToken', 'legacy-refresh-token');
    sessionStorage.setItem('atlas.auth.jwt', 'legacy-jwt');

    await bootstrapAuthStore();

    expect(localStorage.getItem('atlas.auth.accessToken')).toBeNull();
    expect(localStorage.getItem('atlas.auth.refreshToken')).toBeNull();
    expect(sessionStorage.getItem('atlas.auth.jwt')).toBeNull();
  });

  it('does not attempt silent refresh without a stored session hint', async () => {
    const refreshSessionRequest = vi.fn();

    vi.doMock('@/services/authService', () => ({
      login: vi.fn(),
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: vi.fn(),
      refreshSession: refreshSessionRequest,
    }));

    const store = await bootstrapAuthStore();
    const restored = await store.hydrateSession();

    expect(restored).toBe(false);
    expect(refreshSessionRequest).not.toHaveBeenCalled();
    expect(store.isAuthenticated).toBe(false);
  });

  it('hydrates a stored browser session by refreshing through the secure cookie flow', async () => {
    const refreshSessionRequest = vi.fn().mockResolvedValue({
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      accessToken: 'restored-access-token',
      refreshToken: 'server-cookie-token',
    });

    vi.doMock('@/services/authService', () => ({
      login: vi.fn(),
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: vi.fn(),
      refreshSession: refreshSessionRequest,
    }));

    localStorage.setItem(
      AUTH_SESSION_HINT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        hasSessionCookie: true,
        lastAuthenticatedAt: '2026-03-29T08:30:00.000Z',
      }),
    );

    const store = await bootstrapAuthStore();
    const restored = await store.hydrateSession();

    expect(restored).toBe(true);
    expect(refreshSessionRequest).toHaveBeenCalledWith({ allowMockFallback: false });
    expect(store.isAuthenticated).toBe(true);
    expect(store.token).toBe('restored-access-token');
    expect(store.currentUser?.id).toBe('user-1');
    expect(store.hasHydratedSession).toBe(true);
  });

  it('captures login failures as a user-safe auth error', async () => {
    vi.doMock('@/services/authService', () => ({
      login: vi.fn().mockRejectedValue(new Error('Invalid credentials')),
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    }));

    const store = await bootstrapAuthStore();

    await expect(
      store.login({
        email: 'maya@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('Invalid credentials');

    expect(store.error).toBe('Invalid credentials');
    expect(store.isAuthenticated).toBe(false);
  });
});
