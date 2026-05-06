<template>
  <button
    class="spot-marker"
    :class="[
      variant === 'sequence' ? 'spot-marker--sequence' : `badge-${spot.category}`,
      routeRoleClass,
      {
        'is-active': active,
      },
    ]"
    type="button"
    :aria-label="`Open ${spot.title}`"
    @click="$emit('select')"
  >
    <span class="spot-marker__pin" :class="{ 'spot-marker__pin--media': showPhoto }">
      <span v-if="variant === 'sequence' && sequence" class="spot-marker__sequence">{{ sequence }}</span>
      <img
        v-else-if="showPhoto"
        class="spot-marker__thumb"
        :src="photoUrl"
        alt=""
        loading="lazy"
        decoding="async"
      />
      <ScopeIcon v-else :name="iconName" :label="spot.title" />
    </span>
    <span class="spot-marker__label">
      <strong>{{ spot.title }}</strong>
      <small>
        {{ cityLine }}<span v-if="spot.rating">&nbsp;★ {{ spot.rating.toFixed(1) }}</span>
      </small>
      <small v-if="distanceLabel" class="spot-marker__distance">{{ distanceLabel }}</small>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import type { MapPoint } from '@/types';
import { formatMapPinCityLine } from '@/utils/formatters';

const props = withDefaults(
  defineProps<{
    spot: MapPoint;
    active?: boolean;
    variant?: 'default' | 'sequence';
    sequence?: string | number | null;
    distanceLabel?: string | null;
  }>(),
  {
    active: false,
    variant: 'default',
    sequence: null,
    distanceLabel: null,
  },
);

defineEmits<{
  (event: 'select'): void;
}>();

const iconName = computed(() => (props.spot.category === 'other' ? 'pin' : props.spot.category));
const routeRoleClass = computed(() => (props.spot.routeRole ? `spot-marker--route-${props.spot.routeRole}` : ''));

const photoUrl = computed(() => props.spot.photoUrl?.trim() ?? '');

const showPhoto = computed(
  () => Boolean(photoUrl.value) && props.variant !== 'sequence',
);

const cityLine = computed(() => formatMapPinCityLine(props.spot.city));
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

.spot-marker__pin--media {
  transform: none;
  border-radius: 0.85rem;
  overflow: hidden;
  padding: 0;
  background: var(--bg-tertiary);
}

.spot-marker__thumb {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.spot-marker__pin :deep(.scope-icon) {
  width: 1.1rem;
  height: 1.1rem;
  transform: rotate(-45deg);
}

.spot-marker__pin--media :deep(.scope-icon) {
  transform: none;
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

.spot-marker__distance {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.spot-marker__sequence {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-small);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: 0;
  text-transform: uppercase;
  color: var(--route-marker-ink, var(--text-inverse));
}

.spot-marker--sequence {
  --route-marker-color: var(--accent-teal);
  --route-marker-ink: var(--text-inverse);
  color: var(--route-marker-color);
}

.spot-marker--sequence .spot-marker__pin {
  border-radius: var(--radius-full);
  border-color: transparent;
  background: var(--route-marker-color);
  box-shadow:
    var(--shadow-lg),
    0 0 1.25rem color-mix(in srgb, var(--route-marker-color) 30%, transparent);
  transform: none;
}

.spot-marker--route-start.spot-marker--sequence {
  --route-marker-color: var(--accent-teal);
}

.spot-marker--route-stop.spot-marker--sequence {
  --route-marker-color: var(--accent-gold);
}

.spot-marker--route-end.spot-marker--sequence {
  --route-marker-color: var(--accent-teal);
}

/*
 * Don’t use background: currentColor with color: --bg-primary on the same node:
 * currentColor would resolve to the dark page background, producing a “black blob”.
 */
.spot-marker.is-active:not(.spot-marker--sequence) .spot-marker__pin:not(.spot-marker__pin--media) {
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-secondary));
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent-teal) 45%, var(--glass-border));
  box-shadow: var(--shadow-lg), var(--shadow-glow-teal);
  transform: rotate(45deg) scale(1.05);
}

.spot-marker.is-active .spot-marker__pin--media {
  border-color: color-mix(in srgb, var(--accent-teal) 60%, var(--glass-border));
  box-shadow: var(--shadow-lg), var(--shadow-glow-teal);
  transform: scale(1.05);
}

.spot-marker--sequence.is-active .spot-marker__pin {
  border-color: color-mix(in srgb, var(--route-marker-color) 30%, white);
  background: var(--route-marker-color);
  color: var(--route-marker-ink);
  box-shadow:
    var(--shadow-lg),
    0 0 1.45rem color-mix(in srgb, var(--route-marker-color) 38%, transparent),
    0 0 0 0.28rem color-mix(in srgb, var(--route-marker-color) 18%, transparent);
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
  .spot-marker.is-active:not(.spot-marker--sequence) .spot-marker__pin:not(.spot-marker__pin--media),
  .spot-marker--sequence.is-active .spot-marker__pin {
    transform: none;
  }

  .spot-marker.is-active .spot-marker__pin--media {
    transform: none;
  }
}
</style>
