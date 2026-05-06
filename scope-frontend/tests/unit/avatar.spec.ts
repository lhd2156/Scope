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
  it('renders a neutral silhouette placeholder and preserves size styles when no image is provided', async () => {
    const wrapper = mount(Avatar, {
      props: {
        name: 'Louis Do',
        size: 56,
      },
    });

    await nextTick();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.avatar__silhouette').exists()).toBe(true);
    expect(wrapper.classes()).toContain('avatar--placeholder');
    expect(wrapper.attributes('aria-label')).toBe('Louis Do');
    expect((wrapper.element as HTMLElement).style.width).toBe('56px');
  });

  it('falls back to the silhouette placeholder when an explicit image fails to load', async () => {
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

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.avatar__silhouette').exists()).toBe(true);
    expect(wrapper.classes()).toContain('avatar--placeholder');
  });
});
