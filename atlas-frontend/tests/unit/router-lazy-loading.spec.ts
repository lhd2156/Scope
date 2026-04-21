describe('router lazy loading', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('wraps every route view with defineAsyncComponent and keeps scroll reset enabled', async () => {
    const router = (await import('@/router')).default;

    const namedRoutes = router
      .getRoutes()
      .filter((route) => typeof route.name === 'string')
      .sort((left, right) => String(left.name).localeCompare(String(right.name)));

    const asyncWrappedRoutes = namedRoutes.map((route) => ({
      name: String(route.name),
      component: route.components?.default,
    }));

    expect(asyncWrappedRoutes.map((route) => route.name)).toEqual([
      'explore',
      'friends',
      'home',
      'login',
      'map',
      'not-found',
      'profile',
      'register',
      'settings',
      'spot-create',
      'spot-detail',
      'spot-edit',
      'trip-detail',
      'trip-planner',
    ]);

    expect(asyncWrappedRoutes.every((route) => Boolean((route.component as { __asyncLoader?: unknown } | undefined)?.__asyncLoader))).toBe(true);
    expect(router.options.scrollBehavior?.()).toEqual({ top: 0 });
  });
});
