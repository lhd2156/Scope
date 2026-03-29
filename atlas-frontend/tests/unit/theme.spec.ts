async function loadThemeModule() {
  vi.resetModules();
  return import('@/utils/theme');
}

describe('theme utility', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
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

  it('hydrates the stored theme and keeps shared state in sync when toggled', async () => {
    localStorage.setItem('atlas-theme', 'light');

    const { initializeTheme, toggleTheme, useTheme } = await loadThemeModule();

    initializeTheme();
    expect(useTheme().value).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    toggleTheme();

    expect(useTheme().value).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('atlas-theme')).toBe('dark');
  });
});
