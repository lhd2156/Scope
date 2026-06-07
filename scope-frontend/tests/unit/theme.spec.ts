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

  it('hydrates a stored light preference', async () => {
    localStorage.setItem('scope-theme', 'light');

    const { getStoredTheme, initializeTheme, useTheme } = await loadThemeModule();

    expect(getStoredTheme()).toBe('light');
    initializeTheme();

    expect(useTheme().value).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('scope-theme')).toBe('light');
    expect(trackThemeToggleMock).not.toHaveBeenCalled();
  });

  it('toggles between light and dark from the navbar and tracks each real change', async () => {
    const { initializeTheme, toggleTheme, useTheme } = await loadThemeModule();

    initializeTheme();
    expect(toggleTheme('navbar')).toBe('light');
    await flushPromises();

    expect(useTheme().value).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('scope-theme')).toBe('light');
    expect(trackThemeToggleMock).toHaveBeenLastCalledWith({
      theme: 'light',
      previousTheme: 'dark',
      source: 'navbar',
      routeName: undefined,
    });

    expect(toggleTheme('navbar')).toBe('dark');
    await flushPromises();

    expect(useTheme().value).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('scope-theme')).toBe('dark');
    expect(trackThemeToggleMock).toHaveBeenLastCalledWith({
      theme: 'dark',
      previousTheme: 'light',
      source: 'navbar',
      routeName: undefined,
    });
  });

  it('applies and tracks settings theme changes', async () => {
    const { applyTheme, initializeTheme, useTheme } = await loadThemeModule();

    initializeTheme();
    applyTheme('light', { track: true, source: 'settings' });
    await flushPromises();

    expect(useTheme().value).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('scope-theme')).toBe('light');
    expect(trackThemeToggleMock).toHaveBeenCalledWith({
      theme: 'light',
      previousTheme: 'dark',
      source: 'settings',
      routeName: 'settings',
    });
  });

  it('keeps live theme state usable when storage, document, or transitions fail', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const { applyTheme, getStoredTheme, toggleTheme } = await loadThemeModule();

    expect(getStoredTheme()).toBe('dark');
    getItemSpy.mockRestore();

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    setItemSpy.mockRestore();

    const originalDocument = document;
    vi.stubGlobal('document', undefined);
    expect(() => applyTheme('dark')).not.toThrow();
    vi.stubGlobal('document', originalDocument);

    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });

    toggleTheme('navbar');

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.themeTransition).toBeUndefined();
  });
});
