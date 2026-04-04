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
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    vi.doUnmock('@/services/analyticsService');
    trackThemeToggleMock.mockReset();
  });

  it('defaults to dark mode when no stored preference exists', async () => {
    const { getStoredTheme, initializeTheme, useTheme } = await loadThemeModule();

    expect(getStoredTheme()).toBe('dark');
    initializeTheme();

    expect(useTheme().value).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('atlas-theme')).toBe('dark');
  });

  it('hydrates the stored theme and tracks user-triggered theme changes', async () => {
    localStorage.setItem('atlas-theme', 'light');

    const { applyTheme, initializeTheme, toggleTheme, useTheme } = await loadThemeModule();

    initializeTheme();
    expect(useTheme().value).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(trackThemeToggleMock).not.toHaveBeenCalled();

    toggleTheme('navbar');
    await flushPromises();

    expect(useTheme().value).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('atlas-theme')).toBe('dark');
    expect(trackThemeToggleMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      theme: 'dark',
      previousTheme: 'light',
      source: 'navbar',
    }));

    applyTheme('light', { track: true, source: 'settings' });
    await flushPromises();

    expect(trackThemeToggleMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      theme: 'light',
      previousTheme: 'dark',
      source: 'settings',
      routeName: 'settings',
    }));
  });
});
