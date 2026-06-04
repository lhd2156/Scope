import { flushPromises } from '@vue/test-utils';

const trackThemeToggleMock = vi.hoisted(() => vi.fn());

async function loadThemeModule() {
  vi.resetModules();
  vi.doMock('@/services/analyticsService', () => ({
    trackThemeToggle: trackThemeToggleMock,
  }));
  return import('@/utils/theme');
}

describe('theme utility', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-transition');
    document.documentElement.removeAttribute('data-theme-transition-from');
    document.documentElement.removeAttribute('data-theme-transition-mode');
    document.documentElement.style.colorScheme = '';
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  afterEach(() => {
    vi.doUnmock('@/services/analyticsService');
    trackThemeToggleMock.mockReset();
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  it('defaults to dark mode when no stored preference exists', async () => {
    const { getStoredTheme, initializeTheme, useTheme } = await loadThemeModule();

    expect(getStoredTheme()).toBe('dark');
    initializeTheme();

    expect(useTheme().value).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('scope-theme')).toBe('dark');
  });

  it('ignores stored light preferences and keeps user-triggered theme changes dark-only', async () => {
    localStorage.setItem('scope-theme', 'light');

    const { applyTheme, initializeTheme, toggleTheme, useTheme } = await loadThemeModule();

    initializeTheme();
    expect(useTheme().value).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(trackThemeToggleMock).not.toHaveBeenCalled();

    toggleTheme('navbar');
    await flushPromises();

    expect(useTheme().value).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('scope-theme')).toBe('dark');
    expect(trackThemeToggleMock).not.toHaveBeenCalled();

    applyTheme('light', { track: true, source: 'settings' });
    await flushPromises();

    expect(useTheme().value).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(trackThemeToggleMock).not.toHaveBeenCalled();
  });

  it('does not run view transitions for the coming-soon theme control', async () => {
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });

    const { initializeTheme, toggleTheme } = await loadThemeModule();

    initializeTheme();
    toggleTheme('navbar');

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.dataset.themeTransition).toBeUndefined();

    await flushPromises();

    expect(document.documentElement.dataset.themeTransition).toBeUndefined();
  });

  it('does not run the map overlay path for the coming-soon theme control', async () => {
    vi.useFakeTimers();
    const mapView = document.createElement('div');
    mapView.className = 'map-view';
    document.body.append(mapView);
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });

    const { initializeTheme, toggleTheme } = await loadThemeModule();

    initializeTheme();
    toggleTheme('navbar');

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.dataset.themeTransition).toBeUndefined();
    expect(document.documentElement.dataset.themeTransitionMode).toBeUndefined();
    expect(document.documentElement.dataset.themeTransitionFrom).toBeUndefined();

    vi.advanceTimersByTime(260);

    expect(document.documentElement.dataset.themeTransition).toBeUndefined();
    expect(document.documentElement.dataset.themeTransitionMode).toBeUndefined();
    expect(document.documentElement.dataset.themeTransitionFrom).toBeUndefined();
    mapView.remove();
  });

  it('keeps theme state stable when storage, motion, document, or transitions fail', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const { applyTheme, getStoredTheme, initializeTheme } = await loadThemeModule();

    expect(getStoredTheme()).toBe('dark');
    getItemSpy.mockRestore();

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    setItemSpy.mockRestore();

    const originalDocument = document;
    vi.stubGlobal('document', undefined);
    expect(() => applyTheme('dark')).not.toThrow();
    vi.stubGlobal('document', originalDocument);

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    applyTheme('light', { animate: true });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn(() => {
        throw new Error('transition failed');
      }),
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    applyTheme('dark', { animate: true });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.dataset.themeTransition).toBeUndefined();

    initializeTheme();
  });
});
