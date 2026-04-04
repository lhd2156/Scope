type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type NonCriticalTask = () => void | Promise<void>;

const DEFAULT_IDLE_TIMEOUT_MS = 900;
const DEFAULT_DELAY_MS = 120;

export type CancelScheduledTask = () => void;

export function isUiTestEnvironment(): boolean {
  const importMetaTest = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.MODE === 'test' || import.meta.env?.VITEST);
  const processTest = typeof process !== 'undefined' && Boolean(process.env?.VITEST || process.env?.NODE_ENV === 'test');
  const domTest = typeof navigator !== 'undefined' && /jsdom|happy-dom/i.test(navigator.userAgent);

  return importMetaTest || processTest || domTest;
}

export function scheduleNonCriticalTask(
  task: NonCriticalTask,
  options: { delayMs?: number; timeoutMs?: number } = {},
): CancelScheduledTask {
  if (typeof window === 'undefined' || isUiTestEnvironment()) {
    void task();
    return () => undefined;
  }

  const browserWindow = window as IdleWindow;
  const delayMs = Math.max(0, options.delayMs ?? DEFAULT_DELAY_MS);
  const timeoutMs = Math.max(delayMs + 100, options.timeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS);
  let isCancelled = false;
  let hasRun = false;
  let timeoutHandle: number | null = null;
  let idleHandle: number | null = null;

  const runTask = () => {
    if (isCancelled || hasRun) {
      return;
    }

    hasRun = true;
    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    if (idleHandle !== null && typeof browserWindow.cancelIdleCallback === 'function') {
      browserWindow.cancelIdleCallback(idleHandle);
      idleHandle = null;
    }

    void task();
  };

  if (typeof browserWindow.requestIdleCallback === 'function') {
    idleHandle = browserWindow.requestIdleCallback(runTask, { timeout: timeoutMs });
    timeoutHandle = window.setTimeout(runTask, delayMs);
  } else {
    timeoutHandle = window.setTimeout(runTask, delayMs);
  }

  return () => {
    isCancelled = true;

    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    if (idleHandle !== null && typeof browserWindow.cancelIdleCallback === 'function') {
      browserWindow.cancelIdleCallback(idleHandle);
      idleHandle = null;
    }
  };
}
