<template>
  <img
    v-if="shouldRenderImage && activeSrc && !hasError"
    ref="rootRef"
    v-bind="attrs"
    :src="activeSrc"
    :alt="alt"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
    :fetchpriority="eager ? 'high' : 'auto'"
    :class="['lazy-image', { 'is-loaded': isLoaded }]"
    @load="handleLoad"
    @error="handleError"
  />
  <div
    v-else
    ref="rootRef"
    v-bind="attrs"
    :class="['lazy-image', 'lazy-image-placeholder', { 'is-error': hasError }]"
    aria-hidden="true"
  >
    <span class="lazy-image-placeholder__shimmer" />
  </div>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
});

import { nextTick, onBeforeUnmount, onMounted, ref, useAttrs, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    src: string;
    alt?: string;
    eager?: boolean;
    rootMargin?: string;
    threshold?: number;
    fallbackSrc?: string;
  }>(),
  {
    alt: '',
    eager: false,
    rootMargin: '240px 0px',
    threshold: 0.01,
    fallbackSrc: '',
  },
);

const emit = defineEmits<{
  (event: 'load'): void;
  (event: 'error'): void;
}>();

const attrs = useAttrs();
const rootRef = ref<HTMLElement | null>(null);
const isLoaded = ref(false);
const hasError = ref(false);
const shouldRenderImage = ref(false);
const activeSrc = ref('');
let observer: IntersectionObserver | null = null;

function supportsIntersectionObserver(): boolean {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window;
}

function disconnectObserver() {
  observer?.disconnect();
  observer = null;
}

function revealImage() {
  shouldRenderImage.value = Boolean(activeSrc.value);
  disconnectObserver();
}

function observeVisibility() {
  disconnectObserver();

  if (!activeSrc.value || props.eager || !supportsIntersectionObserver()) {
    shouldRenderImage.value = Boolean(activeSrc.value);
    return;
  }

  shouldRenderImage.value = false;

  if (!rootRef.value) {
    return;
  }

  observer = new window.IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        revealImage();
      }
    },
    {
      rootMargin: props.rootMargin,
      threshold: props.threshold,
    },
  );

  observer.observe(rootRef.value);
}

function getPrimarySource(): string {
  return props.src.trim();
}

function getFallbackSource(): string {
  return props.fallbackSrc.trim();
}

function syncSources() {
  activeSrc.value = getPrimarySource() || getFallbackSource();
  isLoaded.value = false;
  hasError.value = false;
}

function handleLoad() {
  isLoaded.value = true;
  emit('load');
}

function handleError() {
  const fallbackSource = getFallbackSource();

  if (fallbackSource && activeSrc.value !== fallbackSource) {
    activeSrc.value = fallbackSource;
    hasError.value = false;
    isLoaded.value = false;
    shouldRenderImage.value = true;
    return;
  }

  hasError.value = true;
  emit('error');
}

watch(
  () => [props.src, props.fallbackSrc, props.eager, props.rootMargin, props.threshold] as const,
  async () => {
    syncSources();
    await nextTick();
    observeVisibility();
  },
  { immediate: true },
);

onMounted(() => {
  observeVisibility();
});

onBeforeUnmount(() => {
  disconnectObserver();
});
</script>

<style scoped>
.lazy-image-placeholder {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 40%),
    linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
}

.lazy-image-placeholder.is-error {
  background:
    linear-gradient(135deg, rgba(239, 68, 68, 0.12), transparent),
    linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
}

.lazy-image-placeholder__shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.06) 35%,
    rgba(255, 255, 255, 0.18) 50%,
    rgba(255, 255, 255, 0.06) 65%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: shimmer 1.25s ease-in-out infinite;
}

@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
