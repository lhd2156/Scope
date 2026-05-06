<template>
  <button
    class="cluster-marker"
    type="button"
    :aria-label="`Zoom into cluster with ${pointCount} pins`"
    :data-test="dataTestId"
    @click="$emit('select')"
  >
    <span class="cluster-marker__count">{{ pointCount }}</span>
    <span class="cluster-marker__caption">pins</span>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    pointCount: number;
    dataTestId?: string;
  }>(),
  {
    dataTestId: undefined,
  },
);

defineEmits<{
  (event: 'select'): void;
}>();
</script>

<style scoped>
.cluster-marker {
  min-width: 3.4rem;
  min-height: 3.4rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 48%, var(--glass-border));
  border-radius: 999px;
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--accent-gold) 28%, transparent), transparent 58%),
    color-mix(in srgb, var(--glass-bg) 94%, transparent);
  box-shadow:
    var(--shadow-lg),
    0 0 1.2rem color-mix(in srgb, var(--accent-teal) 18%, transparent);
  color: var(--text-primary);
  display: grid;
  justify-items: center;
  gap: 0.1rem;
  cursor: pointer;
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.cluster-marker:hover,
.cluster-marker:focus-visible {
  transform: translateY(-0.125rem) scale(1.02);
  border-color: color-mix(in srgb, var(--accent-teal) 75%, var(--accent-gold));
  box-shadow:
    var(--shadow-lg),
    0 0 1.5rem color-mix(in srgb, var(--accent-teal) 24%, transparent);
  outline: none;
}

.cluster-marker:active {
  transform: scale(0.98);
}

.cluster-marker__count {
  font-size: 1.05rem;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.cluster-marker__caption {
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .cluster-marker,
  .cluster-marker:hover,
  .cluster-marker:focus-visible,
  .cluster-marker:active {
    transform: none;
    transition: none;
  }
}
</style>
