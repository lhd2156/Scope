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

  it('keeps placeholders stable for empty sources and non-visible fallback checks', async () => {
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    const requestAnimationFrame = vi.fn((_callback: FrameRequestCallback) => 12);
    const cancelAnimationFrame = vi.fn();

    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: class {
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

    const emptyWrapper = mount(LazyImage, {
      props: {
        src: '   ',
        fallbackSrc: '   ',
        alt: 'Empty image',
      },
    });
    await nextTick();

    expect(emptyWrapper.find('img').exists()).toBe(false);
    expect(observeMock).not.toHaveBeenCalled();
    emptyWrapper.unmount();

    const hiddenWrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/later.jpg',
        alt: 'Deferred image',
        rootMargin: '0px',
      },
      attachTo: document.body,
    });

    const root = hiddenWrapper.element as HTMLElement;
    root.getBoundingClientRect = () => ({
      width: 0,
      height: 0,
      left: 0,
      top: window.innerHeight + 500,
      right: 0,
      bottom: window.innerHeight + 500,
      x: 0,
      y: window.innerHeight + 500,
      toJSON: () => ({}),
    } as DOMRect);

    await hiddenWrapper.setProps({ rootMargin: '0px 0px' });
    await nextTick();

    expect(hiddenWrapper.find('img').exists()).toBe(false);
    const scheduledFrameCount = requestAnimationFrame.mock.calls.length;
    expect(scheduledFrameCount).toBeGreaterThan(0);

    window.dispatchEvent(new Event('scroll'));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(scheduledFrameCount);

    hiddenWrapper.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(12);
    expect(disconnectMock).toHaveBeenCalled();
  });

  it('parses percent, empty, and invalid fallback margins without animation-frame support', async () => {
    const observeMock = vi.fn();
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: class {
        observe = observeMock;
        disconnect = vi.fn();
      },
    });
    Reflect.deleteProperty(window, 'requestAnimationFrame');

    const rectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        width: 120,
        height: 80,
        left: 0,
        top: window.innerHeight + 20,
        right: 120,
        bottom: window.innerHeight + 100,
        x: 0,
        y: window.innerHeight + 20,
        toJSON: () => ({}),
      } as DOMRect);

    const percentWrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/percent-margin.jpg',
        alt: 'Percent margin image',
        rootMargin: '25%',
      },
      attachTo: document.body,
    });
    await nextTick();

    expect(percentWrapper.find('img').exists()).toBe(true);
    percentWrapper.unmount();

    const invalidWrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/invalid-margin.jpg',
        alt: 'Invalid margin image',
        rootMargin: 'bananas',
      },
      attachTo: document.body,
    });
    await nextTick();

    expect(invalidWrapper.find('img').exists()).toBe(false);
    invalidWrapper.unmount();

    const emptyWrapper = mount(LazyImage, {
      props: {
        src: 'https://images.example.com/empty-margin.jpg',
        alt: 'Empty margin image',
        rootMargin: '',
      },
      attachTo: document.body,
    });
    await nextTick();

    expect(emptyWrapper.find('img').exists()).toBe(false);
    expect(observeMock).toHaveBeenCalled();
    emptyWrapper.unmount();
    rectSpy.mockRestore();
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: originalRequestAnimationFrame,
    });
  });
});
