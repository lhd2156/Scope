import { defineAsyncComponent, type Component } from 'vue';

type ShellAsyncComponentModule = { default: Component };
type ShellAsyncComponentLoader = () => Promise<ShellAsyncComponentModule>;

export const SHELL_ASYNC_COMPONENT_MAX_RETRIES = 2;
export const SHELL_ASYNC_COMPONENT_RELOAD_KEY = 'scope-shell-async-component-reload';

const SHELL_ASYNC_COMPONENT_ERROR_PATTERNS = [
  /loading chunk/i,
  /loading css chunk/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /dynamically imported module/i,
  /module script/i,
  /ns_binding_aborted/i,
  /aborted/i,
];

export function isRetryableShellAsyncComponentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return SHELL_ASYNC_COMPONENT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function reloadShellOnceAfterStaleChunk(error: unknown): boolean {
  if (!isRetryableShellAsyncComponentError(error) || typeof window === 'undefined') {
    return false;
  }

  try {
    if (window.sessionStorage.getItem(SHELL_ASYNC_COMPONENT_RELOAD_KEY) === 'reloaded') {
      return false;
    }
    window.sessionStorage.setItem(SHELL_ASYNC_COMPONENT_RELOAD_KEY, 'reloaded');
  } catch {
    // A one-time reload is still the cleanest recovery path if storage is blocked.
  }

  window.location.reload();
  return true;
}

export function defineShellAsyncComponent(loader: ShellAsyncComponentLoader) {
  return defineAsyncComponent({
    loader,
    onError(error, retry, fail, attempts) {
      if (isRetryableShellAsyncComponentError(error) && attempts <= SHELL_ASYNC_COMPONENT_MAX_RETRIES) {
        window.setTimeout(() => retry(), attempts * 200);
        return;
      }

      if (reloadShellOnceAfterStaleChunk(error)) {
        return;
      }

      fail();
    },
  });
}
