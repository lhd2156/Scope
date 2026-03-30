import { flushPromises } from '@vue/test-utils';
import type { Router } from 'vue-router';

interface MockAuthStore {
  hasHydratedSession: boolean;
  isAuthenticated: boolean;
  hydrateSession: () => Promise<boolean>;
}

const ROUTER_NAVIGATION_TIMEOUT_MS = 15000;

async function loadRouterWithAuthStore(authStore: MockAuthStore): Promise<Router> {
  vi.resetModules();
  window.history.replaceState({}, '', '/');

  vi.doMock('@/stores/auth', () => ({
    useAuthStore: () => authStore,
  }));

  const router = (await import('@/router')).default;
  return router;
}

async function navigate(router: Router, path: string) {
  await router.push(path);
  await router.isReady();
  await flushPromises();
}

describe('router navigation matrix', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.scrollTo = vi.fn();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    vi.doUnmock('@/stores/auth');
    vi.clearAllMocks();
  });

  it(
    'resolves the documented route table plus Atlas authoring routes',
    async () => {
      const router = await loadRouterWithAuthStore({
        hasHydratedSession: true,
        isAuthenticated: false,
        hydrateSession: vi.fn().mockResolvedValue(false),
      });

      const routeMatrix = [
        ['/', 'home'],
        ['/explore', 'explore'],
        ['/map', 'map'],
        ['/trips/new', 'trip-planner'],
        ['/trips/trip-1', 'trip-detail'],
        ['/spots/new', 'spot-create'],
        ['/spots/spot-1/edit', 'spot-edit'],
        ['/spots/spot-1', 'spot-detail'],
        ['/profile/user-1', 'profile'],
        ['/friends', 'friends'],
        ['/settings', 'settings'],
        ['/login', 'login'],
        ['/register', 'register'],
        ['/missing/path', 'not-found'],
      ] as const;

      routeMatrix.forEach(([path, routeName]) => {
        expect(router.resolve(path).name).toBe(routeName);
      });
    },
    ROUTER_NAVIGATION_TIMEOUT_MS,
  );

  it(
    'allows unauthenticated navigation to public routes without hydrating a protected session',
    async () => {
      const authStore = {
        hasHydratedSession: false,
        isAuthenticated: false,
        hydrateSession: vi.fn().mockResolvedValue(false),
      };

      const router = await loadRouterWithAuthStore(authStore);

      await navigate(router, '/explore');
      expect(router.currentRoute.value.name).toBe('explore');

      await navigate(router, '/spots/spot-1');
      expect(router.currentRoute.value.name).toBe('spot-detail');

      await navigate(router, '/missing/path');
      expect(router.currentRoute.value.name).toBe('not-found');
      expect(authStore.hydrateSession).not.toHaveBeenCalled();
    },
    ROUTER_NAVIGATION_TIMEOUT_MS,
  );

  it(
    'redirects unauthenticated protected navigation to login and preserves the full redirect target',
    async () => {
      const authStore = {
        hasHydratedSession: false,
        isAuthenticated: false,
        hydrateSession: vi.fn(async () => {
          authStore.hasHydratedSession = true;
          return false;
        }),
      };

      const router = await loadRouterWithAuthStore(authStore);

      await navigate(router, '/profile/user-1?tab=highlights');

      expect(authStore.hydrateSession).toHaveBeenCalledTimes(1);
      expect(router.currentRoute.value.name).toBe('login');
      expect(router.currentRoute.value.query.redirect).toBe('/profile/user-1?tab=highlights');
    },
    ROUTER_NAVIGATION_TIMEOUT_MS,
  );

  it(
    'redirects authenticated users away from guest-only routes and allows all protected routes through the real router',
    async () => {
      const authStore = {
        hasHydratedSession: true,
        isAuthenticated: true,
        hydrateSession: vi.fn().mockResolvedValue(true),
      };

      const router = await loadRouterWithAuthStore(authStore);

      await navigate(router, '/login');
      expect(router.currentRoute.value.name).toBe('map');

      const protectedPaths = [
        '/trips/new',
        '/trips/trip-1',
        '/spots/new',
        '/spots/spot-1/edit',
        '/profile/user-1',
        '/friends',
        '/settings',
      ];

      for (const path of protectedPaths) {
        await navigate(router, path);
        expect(router.currentRoute.value.fullPath).toBe(path);
      }

      expect(authStore.hydrateSession).not.toHaveBeenCalled();
    },
    ROUTER_NAVIGATION_TIMEOUT_MS,
  );
});
