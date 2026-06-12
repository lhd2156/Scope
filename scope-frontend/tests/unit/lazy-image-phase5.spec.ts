import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import LazyImage from '@/components/common/LazyImage.vue';

describe('LazyImage Phase 5 branch coverage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-scope-qa');
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses fallback visibility checks when IntersectionObserver has not fired yet', async () => {
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(16);
      return 1;
    });
    const cancelAnimationFrame = vi.fn();
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    let intersectionCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: class {
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          intersectionCallback = callback;
        }

        observe = observeMock;
        disconnect = disconnectMock;
      },
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: requestAnimationFrame,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: cancelAnimationFrame,
    });

    const wrapper = mount(LazyImage, {
      props: {
        src: ' https://images.example.com/primary.jpg ',
        fallbackSrc: 'https://images.example.com/fallback.jpg',
        alt: 'Fallback image',
        rootMargin: '10% 0px 25%',
      },
      attachTo: document.body,
    });
    await nextTick();

    const root = wrapper.element as HTMLElement;
    root.getBoundingClientRect = () => ({
      width: 100,
      height: 80,
      left: 0,
      top: window.innerHeight + 10,
      right: 100,
      bottom: window.innerHeight + 90,
      x: 0,
      y: window.innerHeight + 10,
      toJSON: () => ({}),
    } as DOMRect);
    await wrapper.setProps({ rootMargin: '10% 0px 25%' });
    await nextTick();

    expect(observeMock).toHaveBeenCalled();
    expect(requestAnimationFrame).toHaveBeenCalled();
    expect(addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));

    intersectionCallback?.([{ isIntersecting: true }]);
    await nextTick();
    expect(wrapper.find('img').exists()).toBe(true);

    await wrapper.find('img').trigger('error');
    await nextTick();
    expect(wrapper.find('img').attributes('src')).toBe('https://images.example.com/fallback.jpg');
    await wrapper.find('img').trigger('error');
    await nextTick();
    expect(wrapper.emitted('error')).toHaveLength(1);

    wrapper.unmount();
    expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('keeps audit placeholders, eager loading, and non-browser checks stable', async () => {
    document.documentElement.dataset.scopeQa = 'true';
    const auditWrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/audit.jpg',
        alt: 'Audit placeholder',
      },
    });
    await nextTick();
    expect(auditWrapper.find('img').exists()).toBe(false);
    auditWrapper.unmount();
    delete document.documentElement.dataset.scopeQa;

    const eagerWrapper = mount(LazyImage, {
      props: {
        src: '   ',
        fallbackSrc: ' https://images.example.com/eager-fallback.jpg ',
        alt: 'Eager fallback',
        eager: true,
      },
    });
    await nextTick();
    expect(eagerWrapper.find('img').attributes('loading')).toBe('eager');
    await eagerWrapper.find('img').trigger('load');
    expect(eagerWrapper.emitted('load')).toHaveLength(1);
    eagerWrapper.unmount();
  });
});
