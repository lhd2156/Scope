<template>
  <img
    v-if="!shouldUseAuditPlaceholder && shouldRenderImage && activeSrc && !hasError"
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
const shouldUseAuditPlaceholder =
  typeof document !== 'undefined' && document.documentElement.dataset.scopeQa === 'true';
let observer: IntersectionObserver | null = null;
let fallbackVisibilityFrame = 0;
let removeFallbackVisibilityListeners: (() => void) | null = null;

function supportsIntersectionObserver(): boolean {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window;
}

function clearFallbackVisibilityListeners() {
  if (fallbackVisibilityFrame && typeof window !== 'undefined' && 'cancelAnimationFrame' in window) {
    window.cancelAnimationFrame(fallbackVisibilityFrame);
  }

  fallbackVisibilityFrame = 0;
  removeFallbackVisibilityListeners?.();
  removeFallbackVisibilityListeners = null;
}

function disconnectObserver() {
  observer?.disconnect();
  observer = null;
  clearFallbackVisibilityListeners();
}

function revealImage() {
  shouldRenderImage.value = Boolean(activeSrc.value);
  disconnectObserver();
}

function parseRootMarginPart(part: string | undefined, viewportSize: number): number {
  const value = part?.trim();
  if (!value) {
    return 0;
  }

  if (value.endsWith('%')) {
    return (Number.parseFloat(value) / 100) * viewportSize;
  }

  return Number.parseFloat(value) || 0;
}

function getVerticalRootMargin(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  const marginParts = props.rootMargin.trim().split(/\s+/);
  const topMargin = parseRootMarginPart(marginParts[0], window.innerHeight);
  const bottomMargin = parseRootMarginPart(marginParts[2] ?? marginParts[0], window.innerHeight);
  return Math.max(0, topMargin, bottomMargin);
}

function isElementNearViewport(element: HTMLElement): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) {
    return false;
  }

  const verticalMargin = getVerticalRootMargin();
  return rect.bottom >= -verticalMargin && rect.top <= window.innerHeight + verticalMargin;
}

function checkFallbackVisibility() {
  if (rootRef.value && isElementNearViewport(rootRef.value)) {
    revealImage();
  }
}

function scheduleFallbackVisibilityCheck() {
  if (fallbackVisibilityFrame) {
    return;
  }

  if (typeof window === 'undefined' || !('requestAnimationFrame' in window)) {
    checkFallbackVisibility();
    return;
  }

  fallbackVisibilityFrame = window.requestAnimationFrame(() => {
    fallbackVisibilityFrame = 0;
    checkFallbackVisibility();
  });
}

function installFallbackVisibilityListeners() {
  if (typeof window === 'undefined' || removeFallbackVisibilityListeners) {
    return;
  }

  const handleVisibilityChange = () => scheduleFallbackVisibilityCheck();
  window.addEventListener('scroll', handleVisibilityChange, true);
  window.addEventListener('resize', handleVisibilityChange);
  removeFallbackVisibilityListeners = () => {
    window.removeEventListener('scroll', handleVisibilityChange, true);
    window.removeEventListener('resize', handleVisibilityChange);
  };
  scheduleFallbackVisibilityCheck();
}

function observeVisibility() {
  disconnectObserver();

  if (shouldUseAuditPlaceholder) {
    shouldRenderImage.value = false;
    return;
  }

  if (!activeSrc.value || props.eager || !supportsIntersectionObserver()) {
    shouldRenderImage.value = Boolean(activeSrc.value);
    return;
  }

  shouldRenderImage.value = false;

  if (!rootRef.value) {
    return;
  }

  if (isElementNearViewport(rootRef.value)) {
    revealImage();
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
  installFallbackVisibilityListeners();
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

.lazy-image-placeholder.is-error .lazy-image-placeholder__shimmer {
  display: none;
  animation: none;
}

@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
