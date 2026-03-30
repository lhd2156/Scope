<template>
  <button
    class="spot-marker"
    :class="[
      variant === 'sequence' ? 'spot-marker--sequence' : `badge-${spot.category}`,
      {
        'is-active': active,
      },
    ]"
    type="button"
    :aria-label="`Open ${spot.title}`"
    @click="$emit('select')"
  >
    <span class="spot-marker__pin">
      <span v-if="variant === 'sequence' && sequence" class="spot-marker__sequence">{{ sequence }}</span>
      <AtlasIcon v-else :name="iconName" :label="spot.title" />
    </span>
    <span class="spot-marker__label">
      <strong>{{ spot.title }}</strong>
      <small>
        {{ spot.city ?? 'Atlas spot' }}
        <span v-if="spot.rating">· ★ {{ spot.rating.toFixed(1) }}</span>
      </small>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import type { MapPoint } from '@/types';

const props = withDefaults(
  defineProps<{
    spot: MapPoint;
    active?: boolean;
    variant?: 'default' | 'sequence';
    sequence?: number | null;
  }>(),
  {
    active: false,
    variant: 'default',
    sequence: null,
  },
);

defineEmits<{
  (event: 'select'): void;
}>();

const iconName = computed(() => (props.spot.category === 'other' ? 'pin' : props.spot.category));
</script>

<style scoped>
.spot-marker {
  position: relative;
  border: none;
  background: transparent;
  padding: 0;
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  color: inherit;
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.spot-marker:hover,
.spot-marker:focus-visible {
  transform: translateY(-0.125rem);
}

.spot-marker:focus-visible {
  outline: none;
}

.spot-marker__pin {
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  border-radius: 1rem 1rem 1rem 0.5rem;
  border: 2px solid currentColor;
  background: var(--bg-secondary);
  box-shadow: var(--shadow-lg);
  transform: rotate(45deg);
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.spot-marker__pin :deep(.atlas-icon) {
  width: 1.1rem;
  height: 1.1rem;
  transform: rotate(-45deg);
}

.spot-marker__label {
  min-width: 11rem;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-md);
  color: var(--text-primary);
  display: none;
  text-align: left;
}

.spot-marker__label strong,
.spot-marker__label small {
  display: block;
}

.spot-marker__label small {
  margin-top: var(--space-1);
  color: var(--text-secondary);
}

.spot-marker__sequence {
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-small);
  color: var(--bg-primary);
}

.spot-marker--sequence {
  color: var(--accent-teal);
}

.spot-marker--sequence .spot-marker__pin {
  border-radius: var(--radius-full);
  border-color: transparent;
  background: var(--accent-teal);
  box-shadow: var(--shadow-lg), var(--shadow-glow-teal);
  transform: none;
}

.spot-marker.is-active .spot-marker__pin {
  background: currentColor;
  color: var(--bg-primary);
  box-shadow: var(--shadow-lg), var(--shadow-glow-teal);
  transform: rotate(45deg) scale(1.05);
}

.spot-marker--sequence.is-active .spot-marker__pin {
  transform: scale(1.08);
}

.spot-marker.is-active .spot-marker__label,
.spot-marker:hover .spot-marker__label,
.spot-marker:focus-visible .spot-marker__label {
  display: block;
}

@media (prefers-reduced-motion: reduce) {
  .spot-marker,
  .spot-marker__pin {
    transition: none;
  }

  .spot-marker:hover,
  .spot-marker:focus-visible,
  .spot-marker.is-active .spot-marker__pin,
  .spot-marker--sequence.is-active .spot-marker__pin {
    transform: none;
  }
}
</style>
