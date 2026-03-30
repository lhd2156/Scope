import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import Avatar from '@/components/common/Avatar.vue';

describe('Avatar', () => {
  const originalObserver = window.IntersectionObserver;

  beforeEach(() => {
    delete (window as Window & typeof globalThis & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    delete (globalThis as typeof globalThis & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
  });

  afterEach(() => {
    if (originalObserver) {
      Object.defineProperty(window, 'IntersectionObserver', {
        configurable: true,
        writable: true,
        value: originalObserver,
      });
      Object.defineProperty(globalThis, 'IntersectionObserver', {
        configurable: true,
        writable: true,
        value: originalObserver,
      });
    }
  });
  it('renders a pravatar fallback image and preserves size styles when no image is provided', async () => {
    const wrapper = mount(Avatar, {
      props: {
        name: 'Louis Do',
        size: 56,
      },
    });

    await nextTick();

    expect(wrapper.find('img').attributes('src')).toMatch(/^https:\/\/i\.pravatar\.cc\/150\?img=\d+$/);
    expect(wrapper.attributes('aria-label')).toBe('Louis Do');
    expect((wrapper.element as HTMLElement).style.width).toBe('56px');
  });

  it('swaps a broken explicit image to the pravatar fallback before showing initials', async () => {
    const wrapper = mount(Avatar, {
      props: {
        name: 'Maya Chen',
        src: 'https://images.example.com/maya.jpg',
      },
    });

    await nextTick();
    expect(wrapper.find('img').attributes('src')).toContain('maya.jpg');

    await wrapper.get('img').trigger('error');
    await nextTick();

    expect(wrapper.find('img').attributes('src')).toMatch(/^https:\/\/i\.pravatar\.cc\/150\?img=\d+$/);
    expect(wrapper.text()).not.toContain('MC');
  });
});
