import { flushPromises } from '@vue/test-utils';
import type { Router } from 'vue-router';

const trackRoutePageViewMock = vi.hoisted(() => vi.fn());
const beginRoutePageEngagementMock = vi.hoisted(() => vi.fn());
const attachAnalyticsPageEngagementTrackerMock = vi.hoisted(() => vi.fn());

interface MockAuthStore {
  hasHydratedSession: boolean;
  isAuthenticated: boolean;
  hydrateSession: () => Promise<boolean>;
}

const ROUTER_NAVIGATION_TIMEOUT_MS = 45000;

async function loadRouterWithAuthStore(authStore: MockAuthStore): Promise<Router> {
  vi.resetModules();
  window.history.replaceState({}, '', '/');

  vi.doMock('@/stores/auth', () => ({
    useAuthStore: () => authStore,
  }));

  vi.doMock('@/services/analyticsService', () => ({
    attachAnalyticsPageEngagementTracker: attachAnalyticsPageEngagementTrackerMock,
    beginRoutePageEngagement: beginRoutePageEngagementMock,
    trackRoutePageView: trackRoutePageViewMock,
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
    vi.doUnmock('@/services/analyticsService');
    vi.clearAllMocks();
    trackRoutePageViewMock.mockReset();
    beginRoutePageEngagementMock.mockReset();
    attachAnalyticsPageEngagementTrackerMock.mockReset();
  });

  it(
    'resolves the documented route table plus Scope authoring routes',
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

      expect(router.resolve('/ai/ask').matched[0]?.redirect).toEqual({ name: 'trip-planner', query: { assistant: 'open' } });
      expect(router.resolve('/scope/ai').matched[0]?.redirect).toEqual({ name: 'trip-planner', query: { assistant: 'open' } });
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
    'tracks page views after successful navigations through the real router afterEach hook',
    async () => {
      const router = await loadRouterWithAuthStore({
        hasHydratedSession: true,
        isAuthenticated: false,
        hydrateSession: vi.fn().mockResolvedValue(false),
      });

      await navigate(router, '/explore?city=austin');
      await navigate(router, '/spots/spot-1');

      expect(attachAnalyticsPageEngagementTrackerMock).toHaveBeenCalledTimes(1);
      expect(trackRoutePageViewMock).toHaveBeenCalledTimes(2);
      expect(beginRoutePageEngagementMock).toHaveBeenCalledTimes(2);
      expect(trackRoutePageViewMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        path: '/explore',
        fullPath: '/explore?city=austin',
        name: 'explore',
      }));
      expect(beginRoutePageEngagementMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        path: '/explore',
        fullPath: '/explore?city=austin',
        name: 'explore',
      }));
      expect(trackRoutePageViewMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        path: '/spots/spot-1',
        fullPath: '/spots/spot-1',
        name: 'spot-detail',
      }));
      expect(beginRoutePageEngagementMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        path: '/spots/spot-1',
        fullPath: '/spots/spot-1',
        name: 'spot-detail',
      }));
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

      await navigate(router, '/ai/ask');
      expect(router.currentRoute.value.name).toBe('trip-planner');
      expect(router.currentRoute.value.fullPath).toBe('/trips/new?assistant=open');

      await navigate(router, '/ai/trip-planner');
      expect(router.currentRoute.value.name).toBe('trip-planner');
      expect(router.currentRoute.value.fullPath).toBe('/trips/new?assistant=open');

      expect(authStore.hydrateSession).not.toHaveBeenCalled();
    },
    ROUTER_NAVIGATION_TIMEOUT_MS,
  );
});
