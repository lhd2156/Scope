<template>
  <span class="loading-spinner" :class="[`size-${size}`]" :aria-label="label" role="status">
    <span class="loading-spinner__ring" aria-hidden="true" />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
    label?: string;
  }>(),
  {
    size: 'md',
    label: 'Loading',
  },
);
</script>

<style scoped>
.loading-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-teal);
}

.loading-spinner__ring {
  display: inline-block;
  border-radius: var(--radius-full);
  border: 2px solid color-mix(in srgb, var(--accent-teal) 22%, transparent);
  border-top-color: currentColor;
  animation: spinner-rotate 0.75s linear infinite;
}

.size-sm .loading-spinner__ring {
  width: 0.95rem;
  height: 0.95rem;
}

.size-md .loading-spinner__ring {
  width: 1.25rem;
  height: 1.25rem;
}

.size-lg .loading-spinner__ring {
  width: 1.85rem;
  height: 1.85rem;
  border-width: 3px;
}

@keyframes spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>
