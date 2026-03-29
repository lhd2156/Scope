<template>
  <span
    class="skeleton-block"
    :class="[`skeleton-block--${shape}`, `skeleton-block--${tone}`]"
    :style="{
      '--skeleton-width': width,
      '--skeleton-height': height,
    }"
    aria-hidden="true"
    data-test="skeleton-block"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string;
    height?: string;
    shape?: 'line' | 'pill' | 'circle' | 'rect';
    tone?: 'default' | 'soft';
  }>(),
  {
    width: '100%',
    height: '1rem',
    shape: 'line',
    tone: 'default',
  },
);
</script>

<style scoped>
.skeleton-block {
  display: block;
  width: min(100%, var(--skeleton-width));
  height: var(--skeleton-height);
  max-width: 100%;
  border-radius: var(--radius-md);
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--bg-elevated) 78%, var(--border) 22%) 0%,
      color-mix(in srgb, var(--bg-tertiary) 68%, white 32%) 50%,
      color-mix(in srgb, var(--bg-elevated) 78%, var(--border) 22%) 100%
    );
  background-size: 220% 100%;
  animation: atlas-skeleton-shimmer 1.3s ease-in-out infinite;
}

.skeleton-block--soft {
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--glass-bg) 82%, var(--border) 18%) 0%,
      color-mix(in srgb, var(--bg-elevated) 70%, white 30%) 50%,
      color-mix(in srgb, var(--glass-bg) 82%, var(--border) 18%) 100%
    );
  background-size: 220% 100%;
}

.skeleton-block--line {
  border-radius: var(--radius-full);
}

.skeleton-block--pill {
  border-radius: var(--radius-full);
}

.skeleton-block--circle {
  width: var(--skeleton-width);
  border-radius: 50%;
}

.skeleton-block--rect {
  border-radius: var(--radius-lg);
}

@keyframes atlas-skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-block {
    animation: none;
    background-position: 50% 50%;
  }
}

:root[data-reduced-motion='reduce'] .skeleton-block {
  animation: none;
  background-position: 50% 50%;
}
</style>
