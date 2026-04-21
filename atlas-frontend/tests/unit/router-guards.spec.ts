import type { RouteLocationNormalized } from 'vue-router';

function buildRoute(
  options: {
    fullPath: string;
    requiresAuth?: boolean;
    guestOnly?: boolean;
  },
): RouteLocationNormalized {
  return {
    fullPath: options.fullPath,
    meta: {
      ...(options.requiresAuth ? { requiresAuth: true } : {}),
      ...(options.guestOnly ? { guestOnly: true } : {}),
    },
  } as RouteLocationNormalized;
}

async function loadGuardWithAuthStore(authStore: {
  hasHydratedSession: boolean;
  isAuthenticated: boolean;
  hydrateSession: () => Promise<boolean>;
}) {
  vi.resetModules();
  vi.doMock('@/stores/auth', () => ({
    useAuthStore: () => authStore,
  }));

  return import('@/router/guards');
}

describe('router auth guards', () => {
  afterEach(() => {
    vi.doUnmock('@/stores/auth');
    vi.clearAllMocks();
  });

  it('does not hydrate or redirect for public routes', async () => {
    const authStore = {
      hasHydratedSession: false,
      isAuthenticated: false,
      hydrateSession: vi.fn().mockResolvedValue(false),
    };

    const { resolveNavigationGuard } = await loadGuardWithAuthStore(authStore);
    const result = await resolveNavigationGuard(buildRoute({ fullPath: '/explore' }));

    expect(result).toBe(true);
    expect(authStore.hydrateSession).not.toHaveBeenCalled();
  });

  it('hydrates once and redirects unauthenticated visitors from protected routes to login with a redirect query', async () => {
    const authStore = {
      hasHydratedSession: false,
      isAuthenticated: false,
      hydrateSession: vi.fn().mockResolvedValue(false),
    };

    const { resolveNavigationGuard } = await loadGuardWithAuthStore(authStore);
    const result = await resolveNavigationGuard(buildRoute({ fullPath: '/friends', requiresAuth: true }));

    expect(authStore.hydrateSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      name: 'login',
      query: { redirect: '/friends' },
    });
  });

  it('allows a protected route after secure session hydration restores authentication', async () => {
    const authStore = {
      hasHydratedSession: false,
      isAuthenticated: false,
      hydrateSession: vi.fn(async () => {
        authStore.hasHydratedSession = true;
        authStore.isAuthenticated = true;
        return true;
      }),
    };

    const { resolveNavigationGuard } = await loadGuardWithAuthStore(authStore);
    const result = await resolveNavigationGuard(buildRoute({ fullPath: '/settings', requiresAuth: true }));

    expect(authStore.hydrateSession).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('redirects authenticated users away from guest-only routes to the map workspace', async () => {
    const authStore = {
      hasHydratedSession: true,
      isAuthenticated: true,
      hydrateSession: vi.fn().mockResolvedValue(true),
    };

    const { resolveNavigationGuard } = await loadGuardWithAuthStore(authStore);
    const result = await resolveNavigationGuard(buildRoute({ fullPath: '/login', guestOnly: true }));

    expect(result).toEqual({ name: 'map' });
    expect(authStore.hydrateSession).not.toHaveBeenCalled();
  });

  it('keeps the protected and guest-only route contract aligned with the router definition', async () => {
    vi.resetModules();
    const router = (await import('@/router')).default;

    const protectedRoutes = router
      .getRoutes()
      .filter((route) => route.meta.requiresAuth)
      .map((route) => route.name)
      .filter((name): name is string => typeof name === 'string')
      .sort();

    const guestOnlyRoutes = router
      .getRoutes()
      .filter((route) => route.meta.guestOnly)
      .map((route) => route.name)
      .filter((name): name is string => typeof name === 'string')
      .sort();

    expect(protectedRoutes).toEqual([
      'friends',
      'profile',
      'settings',
      'spot-create',
      'spot-edit',
      'trip-detail',
      'trip-planner',
    ]);
    expect(guestOnlyRoutes).toEqual(['login', 'register']);
  });
});
