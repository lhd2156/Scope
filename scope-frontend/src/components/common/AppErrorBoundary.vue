<template>
  <section
    v-if="hasError"
    ref="fallbackRef"
    class="route-error-boundary glass-panel"
    role="alert"
    aria-live="assertive"
    :aria-labelledby="titleId"
    tabindex="-1"
    data-test="route-error-boundary"
  >
    <p class="route-error-boundary__eyebrow">Scope shell</p>
    <h2 :id="titleId">This workspace hit a snag</h2>
    <p class="route-error-boundary__copy">{{ fallbackMessage }}</p>
    <div class="route-error-boundary__actions">
      <button type="button" class="button button-primary" @click="retryView">
        Try this view again
      </button>
      <RouterLink class="button button-secondary" to="/">
        Back home
      </RouterLink>
    </div>
  </section>

  <div v-else :key="contentVersion" class="route-error-boundary__content">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onErrorCaptured, ref, useId, watch } from 'vue';
import { RouterLink } from 'vue-router';

const CHUNK_ERROR_PATTERNS = [
  /loading chunk/i,
  /loading css chunk/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /dynamically imported module/i,
  /module script/i,
  /ns_binding_aborted/i,
  /aborted/i,
];
const CHUNK_RELOAD_STORAGE_PREFIX = 'scope-route-chunk-reload';
const ROUTE_RECOVERY_STORAGE_PREFIX = 'scope-route-error-recovery';
const TRIP_PLANNER_TRANSIENT_STORAGE_PREFIXES = [
  'scope-trip-planner-packing-checklist:',
  'scope-route-chunk-reload:',
  'scope-route-error-recovery:',
];
const TRIP_PLANNER_TRANSIENT_STORAGE_KEYS = [
  'scope.tripPlanner.mapStyleMode',
];

declare global {
  interface Window {
    __SCOPE_ROUTE_ERROR__?: {
      message: string;
      name: string;
      resetKey: string;
      stack?: string;
      timestamp: string;
    };
  }
}

const props = defineProps<{
  resetKey: string;
}>();

const fallbackRef = ref<HTMLElement | null>(null);
const hasError = ref(false);
const capturedError = ref<unknown>(null);
const contentVersion = ref(0);
const titleId = `route-error-boundary-${useId()}`;

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error.trim();
  }

  return '';
}

function resolveErrorName(error: unknown): string {
  return error instanceof Error && error.name.trim() ? error.name : 'Error';
}

function publishRouteError(error: unknown): void {
  if (typeof window === 'undefined' || !import.meta.env.DEV) {
    return;
  }

  const message = resolveErrorMessage(error) || 'Unknown route error';
  const stack = error instanceof Error ? error.stack : undefined;
  window.__SCOPE_ROUTE_ERROR__ = {
    message,
    name: resolveErrorName(error),
    resetKey: props.resetKey,
    stack,
    timestamp: new Date().toISOString(),
  };

  if (!import.meta.env.VITEST) {
    console.error('[scope-route-boundary]', window.__SCOPE_ROUTE_ERROR__, error);
  }
}

const fallbackMessage = computed(() => {
  const errorMessage = resolveErrorMessage(capturedError.value);

  if (errorMessage && CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage))) {
    return 'Scope could not finish loading that route bundle. Try this view again to request a clean reload.';
  }

  return 'A page-level error interrupted this workspace. Try this view again or head back home while Scope recovers.';
});

const capturedChunkLoadError = computed(() => {
  const errorMessage = resolveErrorMessage(capturedError.value);
  return Boolean(errorMessage && CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage)));
});

function buildChunkReloadStorageKey(): string {
  return `${CHUNK_RELOAD_STORAGE_PREFIX}:${props.resetKey}`;
}

function buildRouteRecoveryStorageKey(): string {
  return `${ROUTE_RECOVERY_STORAGE_PREFIX}:${props.resetKey}`;
}

function isTripPlannerRoute(): boolean {
  const routePath = props.resetKey.split('?')[0] ?? props.resetKey;
  return routePath === '/trips/new' || /^\/trips\/[^/]+\/edit$/.test(routePath);
}

function clearMatchingStorageItems(storage: Storage, predicate: (storageKey: string) => boolean): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key));

  keys.forEach((storageKey) => {
    if (predicate(storageKey)) {
      storage.removeItem(storageKey);
    }
  });
}

function clearTripPlannerTransientStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const shouldClearStorageKey = (storageKey: string) =>
    TRIP_PLANNER_TRANSIENT_STORAGE_KEYS.includes(storageKey) ||
    TRIP_PLANNER_TRANSIENT_STORAGE_PREFIXES.some((prefix) => storageKey.startsWith(prefix));

  try {
    clearMatchingStorageItems(window.localStorage, shouldClearStorageKey);
  } catch {
    // Keep route recovery best-effort when storage access is blocked.
  }

  try {
    clearMatchingStorageItems(window.sessionStorage, shouldClearStorageKey);
  } catch {
    // Keep route recovery best-effort when storage access is blocked.
  }
}

function shouldAutoReloadChunkError(error: unknown): boolean {
  const errorMessage = resolveErrorMessage(error);
  return Boolean(errorMessage && CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage)));
}

function requestRouteReload(): void {
  if (typeof window === 'undefined' || import.meta.env.VITEST) {
    return;
  }

  window.location.reload();
}

function autoReloadChunkErrorOnce(error: unknown): void {
  if (!shouldAutoReloadChunkError(error) || typeof window === 'undefined') {
    return;
  }

  const storageKey = buildChunkReloadStorageKey();
  try {
    if (window.sessionStorage.getItem(storageKey) === 'reloaded') {
      return;
    }
    window.sessionStorage.setItem(storageKey, 'reloaded');
  } catch {
    // Storage can be unavailable in privacy modes; a single reload is still the
    // cleanest recovery path for a stale lazy-route chunk.
  }

  requestRouteReload();
}

function autoRecoverTripPlannerRouteErrorOnce(error: unknown): void {
  if (shouldAutoReloadChunkError(error) || !isTripPlannerRoute() || typeof window === 'undefined') {
    return;
  }

  const storageKey = buildRouteRecoveryStorageKey();
  try {
    if (window.sessionStorage.getItem(storageKey) === 'recovered') {
      return;
    }
    window.sessionStorage.setItem(storageKey, 'recovered');
  } catch {
    // A one-time reload is still worthwhile if session storage is blocked.
  }

  clearTripPlannerTransientStorage();
  requestRouteReload();
}

function resetBoundary(): void {
  capturedError.value = null;
  hasError.value = false;
  contentVersion.value += 1;
}

function retryView(): void {
  if (capturedChunkLoadError.value && typeof window !== 'undefined') {
    requestRouteReload();
    return;
  }

  resetBoundary();
}

watch(
  () => props.resetKey,
  () => {
    if (hasError.value) {
      resetBoundary();
    }
  },
);

onErrorCaptured((error) => {
  capturedError.value = error;
  hasError.value = true;
  publishRouteError(error);
  autoReloadChunkErrorOnce(error);
  autoRecoverTripPlannerRouteErrorOnce(error);
  void nextTick(() => {
    fallbackRef.value?.focus();
  });
  return false;
});
</script>

<style scoped>
.route-error-boundary {
  width: min(100%, 42rem);
  margin: min(18vh, 7rem) auto 0;
  display: grid;
  gap: var(--space-4);
  padding: clamp(var(--space-5), 3vw, var(--space-8));
}

.route-error-boundary:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 4px;
}

.route-error-boundary__eyebrow,
.route-error-boundary__copy,
.route-error-boundary h2 {
  margin: 0;
}

.route-error-boundary__eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.route-error-boundary__copy {
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.route-error-boundary__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.route-error-boundary__content {
  min-height: inherit;
}
</style>
