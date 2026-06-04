import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import {
  SHELL_ASYNC_COMPONENT_MAX_RETRIES,
  SHELL_ASYNC_COMPONENT_RELOAD_KEY,
  defineShellAsyncComponent,
  isRetryableShellAsyncComponentError,
  reloadShellOnceAfterStaleChunk,
} from '@/utils/shellAsyncComponent';

describe('shell async component recovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function withReloadMock(run: (reloadMock: ReturnType<typeof vi.fn>) => void) {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });

    try {
      run(reloadMock);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  }

  it('classifies retryable stale shell loading errors', () => {
    expect(isRetryableShellAsyncComponentError(new Error('Loading chunk 42 failed'))).toBe(true);
    expect(isRetryableShellAsyncComponentError('Failed to fetch dynamically imported module')).toBe(true);
    expect(isRetryableShellAsyncComponentError(new Error('validation failed'))).toBe(false);
    expect(isRetryableShellAsyncComponentError(null)).toBe(false);
  });

  it('reloads only once after a stale chunk and respects the session guard', () => {
    withReloadMock((reloadMock) => {
      expect(reloadShellOnceAfterStaleChunk(new Error('Loading CSS chunk failed'))).toBe(true);
      expect(sessionStorage.getItem(SHELL_ASYNC_COMPONENT_RELOAD_KEY)).toBe('reloaded');
      expect(reloadMock).toHaveBeenCalledTimes(1);

      expect(reloadShellOnceAfterStaleChunk(new Error('Loading CSS chunk failed'))).toBe(false);
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(reloadShellOnceAfterStaleChunk(new Error('plain error'))).toBe(false);
    });
  });

  it('still reloads stale chunks when session storage is blocked', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    withReloadMock((reloadMock) => {
      expect(reloadShellOnceAfterStaleChunk(new Error('NS_BINDING_ABORTED'))).toBe(true);
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('retries retryable async components before rendering the loaded shell piece', async () => {
    vi.useFakeTimers();
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('dynamically imported module failed'))
      .mockResolvedValueOnce({
        __esModule: true,
        default: defineComponent({
          template: '<div data-test="loaded-shell-piece">Loaded</div>',
        }),
      });
    const ShellPiece = defineShellAsyncComponent(loader);
    const wrapper = mount({
      components: { ShellPiece },
      template: '<Suspense><ShellPiece /></Suspense>',
    });

    await flushPromises();
    expect(loader).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(loader).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-test="loaded-shell-piece"]').exists()).toBe(true);
  });

  it('reloads stale shell chunks after retry exhaustion and fails non-retryable errors', async () => {
    vi.resetModules();
    const defineAsyncComponentMock = vi.fn((options) => options);
    vi.doMock('vue', async (importOriginal) => {
      const actual = await importOriginal<typeof import('vue')>();
      return {
        ...actual,
        defineAsyncComponent: defineAsyncComponentMock,
      };
    });

    const { defineShellAsyncComponent: defineMockedShellAsyncComponent } = await import('@/utils/shellAsyncComponent');
    const component = defineMockedShellAsyncComponent(vi.fn()) as unknown as {
      onError: (error: Error, retry: () => void, fail: () => void, attempts: number) => void;
    };
    const retry = vi.fn();
    const fail = vi.fn();

    withReloadMock((reloadMock) => {
      component.onError(
        new Error('Loading chunk 12 failed'),
        retry,
        fail,
        SHELL_ASYNC_COMPONENT_MAX_RETRIES + 1,
      );

      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(retry).not.toHaveBeenCalled();
      expect(fail).not.toHaveBeenCalled();
    });

    component.onError(new Error('validation failed'), retry, fail, 1);

    expect(fail).toHaveBeenCalledTimes(1);
    vi.doUnmock('vue');
    vi.resetModules();
  });

});
