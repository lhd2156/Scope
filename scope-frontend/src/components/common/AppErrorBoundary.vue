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
];

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

const fallbackMessage = computed(() => {
  const errorMessage = resolveErrorMessage(capturedError.value);

  if (errorMessage && CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage))) {
    return 'Scope could not finish loading that route bundle. Try this view again to request a clean reload.';
  }

  return 'A page-level error interrupted this workspace. Try this view again or head back home while Scope recovers.';
});

function resetBoundary(): void {
  capturedError.value = null;
  hasError.value = false;
  contentVersion.value += 1;
}

function retryView(): void {
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
