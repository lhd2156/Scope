import { createPinia, setActivePinia } from 'pinia';

const AUTH_SESSION_HINT_STORAGE_KEY = 'scope-auth-session-hint';
const AUTH_REFRESH_TOKEN_STORAGE_KEY = 'scope-auth-refresh-token-v1';

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

  it('persists a remembered login for browser restarts without storing access tokens', async () => {
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
      rememberMe: true,
    });

    const storedHint = localStorage.getItem(AUTH_SESSION_HINT_STORAGE_KEY);

    expect(loginRequest).toHaveBeenCalledTimes(1);
    expect(store.token).toBe('secret-access-token');
    expect(store.isAuthenticated).toBe(true);
    expect(storedHint).toBeTruthy();
    expect(storedHint).not.toContain('secret-access-token');
    expect(storedHint).not.toContain('secret-refresh-token');
    expect(localStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY)).toBe('secret-refresh-token');
    expect(sessionStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(JSON.parse(storedHint ?? '{}')).toMatchObject({
      version: 1,
      hasSessionCookie: true,
      persistence: 'local',
    });
    expect(JSON.parse(storedHint ?? '{}').expiresAt).toEqual(expect.any(String));
  });

  it('keeps unremembered logins scoped to the current browser session', async () => {
    const loginRequest = vi.fn().mockResolvedValue({
      id: 'user-2',
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
      accessToken: 'secret-access-token',
      refreshToken: 'session-refresh-token',
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
      rememberMe: false,
    });

    const storedHint = sessionStorage.getItem(AUTH_SESSION_HINT_STORAGE_KEY);

    expect(storedHint).toBeTruthy();
    expect(localStorage.getItem(AUTH_SESSION_HINT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY)).toBe('session-refresh-token');
    expect(JSON.parse(storedHint ?? '{}')).toMatchObject({
      version: 1,
      hasSessionCookie: true,
      persistence: 'session',
    });
    expect(JSON.parse(storedHint ?? '{}').expiresAt).toBeUndefined();
  });

  it('purges legacy Scope token keys during store bootstrap', async () => {
    localStorage.setItem('scope.auth.accessToken', 'legacy-access-token');
    localStorage.setItem('scope.auth.refreshToken', 'legacy-refresh-token');
    sessionStorage.setItem('scope.auth.jwt', 'legacy-jwt');
    sessionStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, 'current-refresh-token');

    await bootstrapAuthStore();

    expect(localStorage.getItem('scope.auth.accessToken')).toBeNull();
    expect(localStorage.getItem('scope.auth.refreshToken')).toBeNull();
    expect(sessionStorage.getItem('scope.auth.jwt')).toBeNull();
    expect(sessionStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY)).toBe('current-refresh-token');
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

  it('hydrates a stored remembered browser session by refreshing with the stored refresh token', async () => {
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
        persistence: 'local',
        expiresAt: '2099-03-29T08:30:00.000Z',
      }),
    );
    localStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, 'server-cookie-token');

    const store = await bootstrapAuthStore();
    const restored = await store.hydrateSession();

    expect(restored).toBe(true);
    expect(refreshSessionRequest).toHaveBeenCalledWith({ allowMockFallback: false });
    expect(store.isAuthenticated).toBe(true);
    expect(store.token).toBe('restored-access-token');
    expect(store.currentUser?.id).toBe('user-1');
    expect(store.hasHydratedSession).toBe(true);
    expect(localStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY)).toBe('server-cookie-token');
    expect(sessionStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
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

  it('marks the session as expired when the API unauthorized hook fires', async () => {
    const configureApiSessionHandlers = vi.fn();

    vi.doMock('@/services/api', async () => {
      const actual = await vi.importActual<typeof import('@/services/api')>('@/services/api');
      return {
        ...actual,
        configureApiSessionHandlers,
      };
    });

    vi.doMock('@/services/authService', () => ({
      login: vi.fn(),
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    }));

    const store = await bootstrapAuthStore();
    const handlers = configureApiSessionHandlers.mock.calls[0]?.[0];

    await handlers.handleUnauthorized();

    expect(store.sessionExpiredMessage).toBe('Your session expired. Sign in again to keep planning in Scope.');
    expect(store.isAuthenticated).toBe(false);
  });
});
