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

  it('hydrates light mode and toggles back to dark from the navbar control', async () => {
    localStorage.setItem('scope-theme', 'light');
    const ThemeToggle = await loadThemeToggle();

    const wrapper = mount(ThemeToggle);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('scope-theme')).toBe('light');
    expect(wrapper.attributes('aria-label')).toBe('Light theme active. Switch to dark mode.');
    expect(wrapper.attributes('title')).toBe('Light theme active. Switch to dark mode.');
    expect(wrapper.text()).toContain('Switch to dark mode');

    await wrapper.trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('scope-theme')).toBe('dark');
    expect(wrapper.attributes('aria-label')).toBe('Dark theme active. Switch to light mode.');
  });

  it('keeps multiple mounted theme controls in sync', async () => {
    const ThemeToggle = await loadThemeToggle();
    const firstToggle = mount(ThemeToggle);
    const secondToggle = mount(ThemeToggle);

    expect(firstToggle.attributes('aria-label')).toBe('Dark theme active. Switch to light mode.');
    expect(secondToggle.attributes('aria-label')).toBe('Dark theme active. Switch to light mode.');

    await firstToggle.trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(firstToggle.attributes('aria-label')).toBe('Light theme active. Switch to dark mode.');
    expect(secondToggle.attributes('aria-label')).toBe('Light theme active. Switch to dark mode.');
  });
});
