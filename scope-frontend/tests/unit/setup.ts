import { config, disableAutoUnmount, enableAutoUnmount } from '@vue/test-utils';

vi.stubEnv('VITE_SCOPE_AI_MIN_REPLY_MS', '');

disableAutoUnmount();
enableAutoUnmount(afterEach);

config.global.stubs = { RouterLink: { template: '<a><slot /></a>' } };

if (typeof XMLHttpRequest !== 'undefined') {
  XMLHttpRequest.prototype.open = function open(method: string, url: string | URL): void {
    throw new Error(`Unexpected unit-test XMLHttpRequest: ${method} ${String(url)}`);
  };
}

const windowTimerRegistry = (() => {
  if (typeof window === 'undefined') {
    return null;
  }

  const timeoutIds = new Set<number>();
  const originalSetTimeout = window.setTimeout.bind(window);
  const originalClearTimeout = window.clearTimeout.bind(window);

  window.setTimeout = ((handler, timeout, ...args) => {
    let timeoutId = 0;
    const trackedHandler: TimerHandler =
      typeof handler === 'function'
        ? () => {
            timeoutIds.delete(timeoutId);
            handler(...args);
          }
        : () => {
            timeoutIds.delete(timeoutId);
            window.eval(handler);
          };

    timeoutId = originalSetTimeout(trackedHandler, timeout);
    timeoutIds.add(timeoutId);
    return timeoutId;
  }) as typeof window.setTimeout;

  window.clearTimeout = ((timeoutId) => {
    if (typeof timeoutId === 'number') {
      timeoutIds.delete(timeoutId);
    }

    originalClearTimeout(timeoutId);
  }) as typeof window.clearTimeout;

  return {
    clearAll() {
      for (const timeoutId of timeoutIds) {
        originalClearTimeout(timeoutId);
      }

      timeoutIds.clear();
    },
  };
})();

afterEach(() => {
  try {
    vi.clearAllTimers();
    vi.useRealTimers();
  } catch {
    // Some specs intentionally stub timer globals. Timer cleanup should stay
    // best-effort so teardown does not mask the assertion that failed first.
  }

  windowTimerRegistry?.clearAll();

  if (typeof document !== 'undefined') {
    delete document.documentElement.dataset.scopeQa;
  }

  if (typeof window !== 'undefined') {
    delete (window as Window & { __SCOPE_VISUAL_QA__?: boolean }).__SCOPE_VISUAL_QA__;

    try {
      window.history.replaceState({}, '', '/');
    } catch {
      // Some tests intentionally stub browser globals. Leave those scenarios to
      // the spec-level cleanup and avoid turning teardown into the failure.
    }
  }
});
