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
  it('renders initials and size styles when no image is provided', () => {
    const wrapper = mount(Avatar, {
      props: {
        name: 'Louis Do',
        size: 56,
      },
    });

    expect(wrapper.text()).toContain('LD');
    expect(wrapper.attributes('aria-label')).toBe('Louis Do');
    expect((wrapper.element as HTMLElement).style.width).toBe('56px');
  });

  it('falls back to initials when the image fails to load', async () => {
    const wrapper = mount(Avatar, {
      props: {
        name: 'Maya Chen',
        src: 'https://images.example.com/maya.jpg',
      },
    });

    await nextTick();
    expect(wrapper.find('img').attributes('src')).toContain('maya.jpg');

    await wrapper.get('img').trigger('error');

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('MC');
  });
});
