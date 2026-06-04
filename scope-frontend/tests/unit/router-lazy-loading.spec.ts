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
      'cookies',
      'explore',
      'friends',
      'help',
      'home',
      'login',
      'map',
      'not-found',
      'notifications',
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
      'trip-share',
      'trips',
    ]);

    expect(lazyRoutes.every((route) => typeof route.component === 'function')).toBe(true);
    expect(lazyRoutes.every((route) => !(route.component as { __asyncLoader?: unknown } | undefined)?.__asyncLoader)).toBe(true);
    expect(router.options.scrollBehavior?.()).toEqual({ top: 0 });
  });

  it('retries transient chunk-load failures and rethrows non-retryable errors', async () => {
    const { lazyView } = await import('@/router/lazyView');
    const component = { name: 'LazyLoadedView' };
    const retryableLoader = vi.fn()
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
      .mockRejectedValueOnce(new Error('NS_BINDING_ABORTED while loading module script'))
      .mockResolvedValueOnce({ default: component });

    await expect(lazyView(retryableLoader)()).resolves.toEqual({ default: component });
    expect(retryableLoader).toHaveBeenCalledTimes(3);

    const plainObjectLoader = vi.fn().mockRejectedValue({ message: 'chunk but not an Error' });
    await expect(lazyView(plainObjectLoader)()).rejects.toEqual({ message: 'chunk but not an Error' });
    expect(plainObjectLoader).toHaveBeenCalledTimes(1);

    const permanentLoader = vi.fn().mockRejectedValue(new Error('Syntax exploded'));
    await expect(lazyView(permanentLoader)()).rejects.toThrow('Syntax exploded');
    expect(permanentLoader).toHaveBeenCalledTimes(1);
  });
});
