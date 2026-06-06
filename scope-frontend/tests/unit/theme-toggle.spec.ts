import { mount } from '@vue/test-utils';

async function loadThemeToggle() {
  vi.resetModules();
  return (await import('@/components/common/ThemeToggle.vue')).default;
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('forces dark mode and presents a dark theme status control', async () => {
    localStorage.setItem('scope-theme', 'light');
    const ThemeToggle = await loadThemeToggle();

    const wrapper = mount(ThemeToggle);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('scope-theme')).toBe('dark');
    expect(wrapper.attributes('aria-label')).toBe('Dark theme active');
    expect(wrapper.text()).not.toContain('Coming soon');

    await wrapper.trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('scope-theme')).toBe('dark');
  });

  it('keeps multiple mounted dark status controls stable', async () => {
    const ThemeToggle = await loadThemeToggle();
    const firstToggle = mount(ThemeToggle);
    const secondToggle = mount(ThemeToggle);

    expect(firstToggle.attributes('aria-label')).toBe('Dark theme active');
    expect(secondToggle.attributes('aria-label')).toBe('Dark theme active');

    await firstToggle.trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(firstToggle.attributes('aria-label')).toBe('Dark theme active');
    expect(secondToggle.attributes('aria-label')).toBe('Dark theme active');
  });
});
