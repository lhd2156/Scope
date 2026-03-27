import { applyTheme } from '@/utils/theme';

describe('theme utility', () => {
  it('applies theme on the root element', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
