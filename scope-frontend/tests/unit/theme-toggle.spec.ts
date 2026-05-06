import { nextTick } from 'vue';
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

  it('applies the stored theme and toggles to the opposite mode', async () => {
    localStorage.setItem('scope-theme', 'dark');
    const ThemeToggle = await loadThemeToggle();

    const wrapper = mount(ThemeToggle);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('scope-theme')).toBe('dark');
    expect(wrapper.attributes('aria-label')).toBe('Switch to light mode');

    await wrapper.trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('scope-theme')).toBe('light');
    expect(wrapper.attributes('aria-label')).toBe('Switch to dark mode');
  });

  it('keeps multiple mounted toggles synchronized through the shared theme state', async () => {
    const ThemeToggle = await loadThemeToggle();
    const firstToggle = mount(ThemeToggle);
    const secondToggle = mount(ThemeToggle);

    expect(firstToggle.attributes('aria-label')).toBe('Switch to light mode');
    expect(secondToggle.attributes('aria-label')).toBe('Switch to light mode');

    await firstToggle.trigger('click');
    await nextTick();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(firstToggle.attributes('aria-label')).toBe('Switch to dark mode');
    expect(secondToggle.attributes('aria-label')).toBe('Switch to dark mode');
  });
});
