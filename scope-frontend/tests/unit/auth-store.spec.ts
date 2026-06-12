import { createPinia, setActivePinia } from 'pinia';

const AUTH_SESSION_HINT_STORAGE_KEY = 'scope-auth-session-hint';
const AUTH_SESSION_HINT_CHANGE_EVENT = 'scope-auth-session-hint-change';
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
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'false');
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.doUnmock('@/services/authService');
    vi.doUnmock('@/services/api');
    vi.unstubAllEnvs();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
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

  it('resyncs when a session hint appears after the store already hydrated as signed out', async () => {
    const refreshSessionRequest = vi.fn().mockResolvedValue({
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      accessToken: 'restored-access-token',
      refreshToken: 'restored-refresh-token',
    });

    vi.doMock('@/services/authService', () => ({
      login: vi.fn(),
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: vi.fn(),
      refreshSession: refreshSessionRequest,
    }));

    const store = await bootstrapAuthStore();
    await expect(store.hydrateSession()).resolves.toBe(false);
    expect(store.hasHydratedSession).toBe(true);

    sessionStorage.setItem(
      AUTH_SESSION_HINT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        hasSessionCookie: true,
        lastAuthenticatedAt: '2026-03-29T08:30:00.000Z',
        persistence: 'session',
      }),
    );
    sessionStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, 'restored-refresh-token');
    window.dispatchEvent(new Event(AUTH_SESSION_HINT_CHANGE_EVENT));

    expect(store.hasSessionHint).toBe(true);
    expect(store.hasHydratedSession).toBe(false);

    await expect(store.hydrateSession()).resolves.toBe(true);
    expect(refreshSessionRequest).toHaveBeenCalledWith({ allowMockFallback: false });
    expect(store.isAuthenticated).toBe(true);
    expect(store.token).toBe('restored-access-token');
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

  it('hydrates local-preview sessions with auth fallback enabled', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'true');
    const refreshSessionRequest = vi.fn().mockResolvedValue({
      id: 'local-maya',
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
      homeBase: 'Dallas, TX',
      interests: ['food', 'scenic'],
      accessToken: 'session-access-token',
      refreshToken: 'session-refresh-token',
    });

    vi.doMock('@/services/authService', () => ({
      login: vi.fn(),
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: vi.fn(),
      refreshSession: refreshSessionRequest,
    }));

    sessionStorage.setItem(
      AUTH_SESSION_HINT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        hasSessionCookie: true,
        lastAuthenticatedAt: '2026-03-29T08:30:00.000Z',
        persistence: 'session',
      }),
    );
    sessionStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, 'session-refresh-token');

    const store = await bootstrapAuthStore();
    const restored = await store.hydrateSession();

    expect(restored).toBe(true);
    expect(refreshSessionRequest).toHaveBeenCalledWith({ allowMockFallback: true });
    expect(store.currentUser).toMatchObject({
      id: 'local-maya',
      username: 'maya',
      homeBase: 'Dallas, TX',
      interests: ['food', 'scenic'],
    });
  });

  it('captures login failures as a standard invalid credentials error', async () => {
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

    expect(store.error).toBe('Invalid username or password.');
    expect(store.isAuthenticated).toBe(false);
  });

  it('hides raw server status messages on login failures', async () => {
    vi.doMock('@/services/authService', () => ({
      login: vi.fn().mockRejectedValue(new Error('Request failed with status code 500')),
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    }));

    const store = await bootstrapAuthStore();

    await expect(
      store.login({
        email: 'louisdo',
        password: 'SecurePass123!',
      }),
    ).rejects.toThrow('Request failed with status code 500');

    expect(store.error).toBe('Sign-in service is unavailable right now. Try again in a moment.');
    expect(store.error).not.toContain('status code 500');
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

  it('hydrates and preserves the synthetic QA authenticated session', async () => {
    const configureApiSessionHandlers = vi.fn();
    const setAccessToken = vi.fn();

    vi.doMock('@/services/api', async () => {
      const actual = await vi.importActual<typeof import('@/services/api')>('@/services/api');
      return {
        ...actual,
        configureApiSessionHandlers,
        setAccessToken,
      };
    });
    vi.doMock('@/services/authService', () => ({
      login: vi.fn(),
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    }));

    vi.stubGlobal('crypto', undefined);
    window.history.replaceState({}, '', '/?scopeQaSession=authenticated');

    const store = await bootstrapAuthStore();
    const handlers = configureApiSessionHandlers.mock.calls[0]?.[0];

    await expect(store.hydrateSession()).resolves.toBe(true);

    expect(store.token).toMatch(/^scope-qa-/);
    expect(store.currentUser).toMatchObject({
      id: 'user-1',
      username: 'scope-qa',
      email: '',
      displayName: 'Scope traveler',
    });
    expect(store.hasHydratedSession).toBe(true);
    expect(store.sessionExpiredMessage).toBeNull();
    expect(setAccessToken).toHaveBeenCalledWith(store.token);

    await handlers.handleUnauthorized('ignored while QA mode is authenticated');

    expect(store.isAuthenticated).toBe(true);
    expect(store.sessionExpiredMessage).toBeNull();
  });

  it('registers, signs in with Cognito, and sanitizes current-user updates', async () => {
    const registerRequest = vi.fn().mockResolvedValue({
      id: 'user-new',
      username: 'new-traveler',
      email: 'new@example.com',
      displayName: 'New Traveler',
      accessToken: 'register-access-token',
      refreshToken: 'register-refresh-token',
    });
    const loginWithCognitoRequest = vi.fn().mockResolvedValue({
      id: 'user-google',
      username: 'google-traveler',
      email: 'google@example.com',
      displayName: 'Google Traveler',
      accessToken: 'google-access-token',
      refreshToken: 'google-refresh-token',
    });

    vi.doMock('@/services/authService', () => ({
      login: vi.fn(),
      register: registerRequest,
      loginWithCognito: loginWithCognitoRequest,
      logout: vi.fn(),
      refreshSession: vi.fn(),
    }));

    const store = await bootstrapAuthStore();

    store.updateCurrentUser({ displayName: 'Nobody yet' });
    expect(store.currentUser).toBeNull();

    await store.register({
      firstName: 'New',
      lastName: 'Traveler',
      username: 'new-traveler',
      email: 'new@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      dateOfBirth: '1996-04-15',
      acceptedTerms: true,
    });

    expect(registerRequest).toHaveBeenCalledTimes(1);
    expect(store.isAuthenticated).toBe(true);
    expect(store.currentUser).toMatchObject({ id: 'user-new', displayName: 'New Traveler' });

    store.updateCurrentUser({
      displayName: ' Updated Traveler ',
      bio: 'Loves routes\nand coffee',
      interests: ['food', 'culture'],
    });
    expect(store.currentUser).toMatchObject({
      displayName: 'Updated Traveler',
      bio: 'Loves routes\nand coffee',
      interests: ['food', 'culture'],
    });

    await store.loginWithCognito('google-id-token');

    expect(loginWithCognitoRequest).toHaveBeenCalledWith('google-id-token');
    expect(store.token).toBe('google-access-token');
    expect(store.currentUser).toMatchObject({ id: 'user-google', displayName: 'Google Traveler' });
  });

  it('captures register and Cognito failures and lets the UI clear messages', async () => {
    vi.doMock('@/services/authService', () => ({
      login: vi.fn(),
      register: vi.fn().mockRejectedValue(new Error('registration offline')),
      loginWithCognito: vi.fn().mockRejectedValue(new Error('google offline')),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    }));

    const store = await bootstrapAuthStore();

    await expect(store.register({
      firstName: 'New',
      lastName: 'Traveler',
      username: 'new-traveler',
      email: 'new@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      dateOfBirth: '1996-04-15',
      acceptedTerms: true,
    })).rejects.toThrow('registration offline');
    expect(store.error).toBe('registration offline');

    store.clearError();
    expect(store.error).toBeNull();

    await expect(store.loginWithCognito('google-id-token')).rejects.toThrow('google offline');
    expect(store.error).toBe('google offline');

    store.clearSessionExpiredMessage();
    expect(store.sessionExpiredMessage).toBeNull();
  });

  it('maps API login errors by status and network state', async () => {
    const { ApiClientError } = await import('@/services/api');
    const loginRequest = vi.fn()
      .mockRejectedValueOnce(new ApiClientError({ message: 'Validation failed', status: 422 }))
      .mockRejectedValueOnce(new ApiClientError({ message: 'Gateway unavailable', status: 503 }))
      .mockRejectedValueOnce(new ApiClientError({ message: 'Socket closed', isNetworkError: true }))
      .mockRejectedValueOnce(new ApiClientError({ message: 'Email confirmation required', status: 409 }));

    vi.doMock('@/services/authService', () => ({
      login: loginRequest,
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    }));

    const store = await bootstrapAuthStore();
    const payload = { email: 'maya@example.com', password: 'SecurePass123!' };

    await expect(store.login(payload)).rejects.toThrow('Validation failed');
    expect(store.error).toBe('Invalid username or password.');

    await expect(store.login(payload)).rejects.toThrow('Gateway unavailable');
    expect(store.error).toBe('Sign-in service is unavailable right now. Try again in a moment.');

    await expect(store.login(payload)).rejects.toThrow('Socket closed');
    expect(store.error).toBe('Sign-in service is unavailable right now. Try again in a moment.');

    await expect(store.login(payload)).rejects.toThrow('Email confirmation required');
    expect(store.error).toBe('Email confirmation required');
  });

  it('logs out remotely when possible and falls back to local sign-out on service failure', async () => {
    const loginRequest = vi.fn().mockResolvedValue({
      id: 'user-logout',
      username: 'logout-user',
      email: 'logout@example.com',
      displayName: 'Logout User',
      accessToken: 'logout-access-token',
      refreshToken: 'logout-refresh-token',
    });
    const logoutRequest = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('logout offline'));

    vi.doMock('@/services/authService', () => ({
      login: loginRequest,
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: logoutRequest,
      refreshSession: vi.fn(),
    }));

    const store = await bootstrapAuthStore();

    await store.login({ email: 'logout@example.com', password: 'SecurePass123!' });
    await store.logout();
    expect(logoutRequest).toHaveBeenCalledWith('logout-refresh-token');
    expect(store.isAuthenticated).toBe(false);
    expect(store.error).toBeNull();

    await store.login({ email: 'logout@example.com', password: 'SecurePass123!' });
    await store.logout();
    expect(store.isAuthenticated).toBe(false);
    expect(store.error).toBe('logout offline');
  });

  it('clears stale sessions when refresh fails and avoids duplicate hydrate calls', async () => {
    const deferredRefresh = Promise.withResolvers<any>();
    const refreshSessionRequest = vi.fn()
      .mockReturnValueOnce(deferredRefresh.promise)
      .mockRejectedValueOnce(new Error('refresh offline'));

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
    localStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, 'refresh-token-1');

    const store = await bootstrapAuthStore();
    const firstHydrate = store.hydrateSession();
    const secondHydrate = store.hydrateSession();

    await vi.waitFor(() => expect(refreshSessionRequest).toHaveBeenCalledTimes(1));

    deferredRefresh.resolve({
      id: 'user-restored',
      username: 'restored',
      email: 'restored@example.com',
      displayName: 'Restored Traveler',
      accessToken: 'restored-access-token',
      refreshToken: 'refresh-token-2',
    });

    await expect(firstHydrate).resolves.toBe(true);
    await expect(secondHydrate).resolves.toBe(true);
    expect(store.token).toBe('restored-access-token');

    await expect(store.refreshSession({ captureError: false })).resolves.toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.error).toBeNull();
    expect(localStorage.getItem(AUTH_SESSION_HINT_STORAGE_KEY)).toBeNull();
  });

  it('captures default refresh failures and rejects blank Cognito tokens before network calls', async () => {
    const refreshSessionRequest = vi.fn().mockRejectedValue(new Error('refresh default offline'));
    const loginWithCognitoRequest = vi.fn();

    vi.doMock('@/services/authService', () => ({
      login: vi.fn(),
      register: vi.fn(),
      loginWithCognito: loginWithCognitoRequest,
      logout: vi.fn(),
      refreshSession: refreshSessionRequest,
    }));

    const store = await bootstrapAuthStore();

    await expect(store.refreshSession()).resolves.toBeNull();
    expect(refreshSessionRequest).toHaveBeenCalledWith({ allowMockFallback: false });
    expect(store.error).toBe('refresh default offline');

    await expect(store.loginWithCognito()).rejects.toThrow('Google sign-in is not configured for this build.');
    expect(loginWithCognitoRequest).not.toHaveBeenCalled();
    expect(store.error).toBe('Google sign-in is not configured for this build.');
  });

  it('resolves mock-profile fallbacks, production payloads, and nonstandard login errors safely', async () => {
    const loginRequest = vi.fn()
      .mockResolvedValueOnce({
        id: 'demo-user-1',
        accessToken: 'mock-profile-token',
        refreshToken: 'mock-profile-refresh',
      })
      .mockResolvedValueOnce({
        id: 'prod-user-1',
        username: 'prod.traveler',
        accessToken: 'prod-token',
        refreshToken: 'prod-refresh',
      })
      .mockRejectedValueOnce(new Error('request timeout'))
      .mockRejectedValueOnce(new Error(''))
      .mockRejectedValueOnce('bad credentials');

    vi.doMock('@/services/authService', () => ({
      login: loginRequest,
      register: vi.fn(),
      loginWithCognito: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    }));

    const store = await bootstrapAuthStore();
    await store.login({ email: 'alex.morgan@showcase.scope.local', password: 'SecurePass123!' });
    expect(store.currentUser).toMatchObject({
      id: 'demo-user-1',
      username: 'scope-user',
      email: 'alex.morgan@showcase.scope.local',
      displayName: 'New explorer',
    });

    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_LOCAL_PREVIEW', 'false');
    await store.login({ email: 'prod@example.com', password: 'SecurePass123!' });
    expect(store.currentUser).toMatchObject({
      id: 'prod-user-1',
      username: 'prod.traveler',
      email: '',
      displayName: 'prod.traveler',
    });

    await expect(store.login({ email: 'prod@example.com', password: 'bad' })).rejects.toThrow('request timeout');
    expect(store.error).toBe('Sign-in service is unavailable right now. Try again in a moment.');

    await expect(store.login({ email: 'prod@example.com', password: 'bad' })).rejects.toThrow('');
    expect(store.error).toBe('Invalid username or password.');

    await expect(store.login({ email: 'prod@example.com', password: 'bad' })).rejects.toBe('bad credentials');
    expect(store.error).toBe('Invalid username or password.');
  });
});
