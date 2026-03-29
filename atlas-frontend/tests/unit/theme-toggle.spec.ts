import { mount } from '@vue/test-utils';
import ThemeToggle from '@/components/common/ThemeToggle.vue';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('applies the stored theme and toggles to the opposite mode', async () => {
    localStorage.setItem('atlas-theme', 'dark');

    const wrapper = mount(ThemeToggle);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('atlas-theme')).toBe('dark');

    await wrapper.trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('atlas-theme')).toBe('light');
  });
});
