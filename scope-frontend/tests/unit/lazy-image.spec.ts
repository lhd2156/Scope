import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import LazyImage from '@/components/common/LazyImage.vue';

describe('LazyImage', () => {
  const originalObserver = window.IntersectionObserver;

  function removeIntersectionObserver() {
    delete (window as Window & typeof globalThis & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    delete (globalThis as typeof globalThis & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
  }

  function setIntersectionObserver(mockObserver: typeof IntersectionObserver) {
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: mockObserver,
    });
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: mockObserver,
    });
  }

  afterEach(() => {
    delete document.documentElement.dataset.scopeQa;
    if (originalObserver) {
      setIntersectionObserver(originalObserver);
    } else {
      removeIntersectionObserver();
    }
  });

  it('renders immediately when IntersectionObserver is unavailable', async () => {
    removeIntersectionObserver();

    const wrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/spot.jpg',
        alt: 'Spot hero',
      },
      attrs: {
        class: 'spot-image',
      },
    });

    await nextTick();

    expect(wrapper.find('img').attributes('src')).toContain('spot.jpg');
    expect(wrapper.find('img').attributes('loading')).toBe('lazy');
    expect(wrapper.classes()).toContain('spot-image');
  });

  it('waits for intersection before rendering a non-eager image', async () => {
    let observerCallback: IntersectionObserverCallback | null = null;
    const observe = vi.fn();
    const disconnect = vi.fn();

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '240px 0px';
      thresholds = [0.01];
    }

    setIntersectionObserver(MockIntersectionObserver as unknown as typeof IntersectionObserver);

    const wrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/feed.jpg',
        alt: 'Feed image',
      },
      attrs: {
        class: 'feed-image',
      },
    });

    await nextTick();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.lazy-image-placeholder').exists()).toBe(true);
    expect(observe.mock.calls.length).toBeGreaterThanOrEqual(1);

    observerCallback?.([
      {
        isIntersecting: true,
      } as IntersectionObserverEntry,
    ], {} as IntersectionObserver);
    await nextTick();

    expect(wrapper.find('img').exists()).toBe(true);
    expect(wrapper.find('img').attributes('src')).toContain('feed.jpg');
    expect(disconnect).toHaveBeenCalled();
  });

  it('reveals a visible placeholder even when the observer callback has not fired', async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    const getBoundingClientRect = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        x: 0,
        y: 120,
        width: 320,
        height: 180,
        top: 120,
        right: 320,
        bottom: 300,
        left: 0,
        toJSON: () => undefined,
      });

    class MockIntersectionObserver {
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '240px 0px';
      thresholds = [0.01];
    }

    setIntersectionObserver(MockIntersectionObserver as unknown as typeof IntersectionObserver);

    const wrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/visible-card.jpg',
        alt: 'Visible card image',
      },
    });

    await nextTick();
    await nextTick();

    expect(wrapper.find('img').attributes('src')).toContain('visible-card.jpg');
    expect(observe).not.toHaveBeenCalled();
    getBoundingClientRect.mockRestore();
  });

  it('swaps to a fallback image source before surfacing a terminal error', async () => {
    removeIntersectionObserver();

    const wrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/avatar.jpg',
        fallbackSrc: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800',
        alt: 'Avatar',
      },
    });

    await nextTick();
    expect(wrapper.get('img').attributes('src')).toContain('avatar.jpg');

    await wrapper.get('img').trigger('error');
    await nextTick();

    expect(wrapper.find('img').attributes('src')).toContain('photo-1506929562872-bb421503ef21?w=800');
    expect(wrapper.emitted('error')).toBeUndefined();

    await wrapper.get('img').trigger('error');

    expect(wrapper.emitted('error')).toHaveLength(1);
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.lazy-image-placeholder.is-error').exists()).toBe(true);
  });

  it('emits an error event and falls back to the placeholder when the image fails', async () => {
    removeIntersectionObserver();

    const wrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/avatar.jpg',
        alt: 'Avatar',
      },
    });

    await nextTick();
    await wrapper.get('img').trigger('error');

    expect(wrapper.emitted('error')).toHaveLength(1);
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.lazy-image-placeholder.is-error').exists()).toBe(true);
  });

  it('marks eager images as loaded and resyncs when sources change', async () => {
    removeIntersectionObserver();

    const wrapper = mount(LazyImage, {
      props: {
        src: '  https://images.example.com/original.jpg  ',
        fallbackSrc: 'https://images.example.com/fallback.jpg',
        alt: 'Route preview',
        eager: true,
      },
    });

    await nextTick();

    expect(wrapper.get('img').attributes('src')).toBe('https://images.example.com/original.jpg');
    expect(wrapper.get('img').attributes('loading')).toBe('eager');
    expect(wrapper.get('img').attributes('fetchpriority')).toBe('high');

    await wrapper.get('img').trigger('load');
    expect(wrapper.emitted('load')).toHaveLength(1);
    expect(wrapper.get('img').classes()).toContain('is-loaded');

    await wrapper.setProps({
      src: '',
      fallbackSrc: '  https://images.example.com/updated-fallback.jpg  ',
    });
    await nextTick();

    expect(wrapper.get('img').attributes('src')).toBe('https://images.example.com/updated-fallback.jpg');
    expect(wrapper.get('img').classes()).not.toContain('is-loaded');
  });

  it('uses the audit placeholder while Scope QA mode is active', async () => {
    document.documentElement.dataset.scopeQa = 'true';
    removeIntersectionObserver();

    const wrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/audit-hidden.jpg',
        fallbackSrc: 'https://images.example.com/audit-fallback.jpg',
        alt: 'Hidden during QA',
        eager: true,
      },
    });

    await nextTick();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.lazy-image-placeholder').exists()).toBe(true);

    delete document.documentElement.dataset.scopeQa;
  });

  it('disconnects pending observers on source changes and unmount', async () => {
    let observerCallback: IntersectionObserverCallback | null = null;
    const disconnect = vi.fn();

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      observe = vi.fn();
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '240px 0px';
      thresholds = [0.01];
    }

    setIntersectionObserver(MockIntersectionObserver as unknown as typeof IntersectionObserver);

    const wrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/lazy-1.jpg',
        alt: 'Lazy image',
      },
    });

    await nextTick();
    await wrapper.setProps({ src: 'https://images.example.com/lazy-2.jpg' });
    await nextTick();

    expect(disconnect).toHaveBeenCalled();
    expect(wrapper.find('img').exists()).toBe(false);

    observerCallback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    await nextTick();
    expect(wrapper.find('img').exists()).toBe(false);

    wrapper.unmount();
    expect(disconnect.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
