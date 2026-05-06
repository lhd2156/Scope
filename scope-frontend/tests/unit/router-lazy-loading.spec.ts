describe('router lazy loading', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('registers every route view as a plain lazy factory and keeps scroll reset enabled', async () => {
    const router = (await import('@/router')).default;

    const namedRoutes = router
      .getRoutes()
      .filter((route) => typeof route.name === 'string' && !route.aliasOf)
      .sort((left, right) => String(left.name).localeCompare(String(right.name)));

    const lazyRoutes = namedRoutes.map((route) => ({
      name: String(route.name),
      component: route.components?.default,
    }));

    expect(lazyRoutes.map((route) => route.name)).toEqual([
      'about',
      'accessibility',
      'scope-ai',
      'cookies',
      'explore',
      'friends',
      'help',
      'home',
      'login',
      'map',
      'not-found',
      'onboarding-preferences',
      'privacy',
      'profile',
      'register',
      'security',
      'settings',
      'spot-create',
      'spot-detail',
      'spot-edit',
      'terms',
      'trip-detail',
      'trip-edit',
      'trip-planner',
      'trips',
    ]);

    expect(lazyRoutes.every((route) => typeof route.component === 'function')).toBe(true);
    expect(lazyRoutes.every((route) => !(route.component as { __asyncLoader?: unknown } | undefined)?.__asyncLoader)).toBe(true);
    expect(router.options.scrollBehavior?.()).toEqual({ top: 0 });
  });
});
