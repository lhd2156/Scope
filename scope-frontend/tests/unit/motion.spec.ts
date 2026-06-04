interface MatchMediaController {
  mediaQueryList: MediaQueryList;
  dispatch: (matches: boolean) => void;
}

function createMatchMediaController(initialMatches: boolean, options: { legacyListener?: boolean } = {}): MatchMediaController {
  let listener: ((event: MediaQueryListEvent) => void) | undefined;

  const mediaQueryList = {
    matches: initialMatches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: options.legacyListener ? undefined : vi.fn((_event: string, callback: EventListenerOrEventListenerObject) => {
      listener = callback as (event: MediaQueryListEvent) => void;
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn((callback: (event: MediaQueryListEvent) => void) => {
      listener = callback;
    }),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  return {
    mediaQueryList,
    dispatch(matches: boolean) {
      (mediaQueryList as { matches: boolean }).matches = matches;
      listener?.({ matches, media: '(prefers-reduced-motion: reduce)' } as MediaQueryListEvent);
    },
  };
}

async function loadMotionModule(controller: MatchMediaController) {
  vi.resetModules();
  vi.stubGlobal('matchMedia', vi.fn(() => controller.mediaQueryList));
  return import('@/utils/motion');
}

describe('motion utility', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-reduced-motion');
  });

  it('hydrates reduced-motion state from matchMedia and updates when the preference changes', async () => {
    const controller = createMatchMediaController(true);
    const { initializeMotionPreference, useReducedMotion } = await loadMotionModule(controller);

    initializeMotionPreference();

    expect(useReducedMotion().value).toBe(true);
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('reduce');

    controller.dispatch(false);

    expect(useReducedMotion().value).toBe(false);
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('no-preference');
  });

  it('attaches the media-query listener only once across repeated initialization', async () => {
    const controller = createMatchMediaController(false);
    const { initializeMotionPreference } = await loadMotionModule(controller);

    initializeMotionPreference();
    initializeMotionPreference();

    expect(controller.mediaQueryList.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('falls back when matchMedia is unavailable and supports legacy listeners', async () => {
    vi.resetModules();
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });

    const noMediaModule = await import('@/utils/motion');
    expect(noMediaModule.initializeMotionPreference()).toBe(false);
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('no-preference');

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    });

    const legacyController = createMatchMediaController(false, { legacyListener: true });
    const { initializeMotionPreference, useReducedMotion } = await loadMotionModule(legacyController);
    initializeMotionPreference();
    legacyController.dispatch(true);

    expect(legacyController.mediaQueryList.addListener).toHaveBeenCalledTimes(1);
    expect(useReducedMotion().value).toBe(true);
  });
});
