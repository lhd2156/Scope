<template>
  <div class="map-controls">
    <section class="control-stack glass-panel">
      <button class="control-button" type="button" aria-label="Zoom in" :disabled="!interactive" @click="$emit('zoom-in')">
        <AtlasIcon name="zoom-in" label="Zoom in" />
      </button>
      <button class="control-button" type="button" aria-label="Zoom out" :disabled="!interactive" @click="$emit('zoom-out')">
        <AtlasIcon name="zoom-out" label="Zoom out" />
      </button>
      <button class="control-button" type="button" aria-label="Center on my location" :disabled="!interactive" @click="$emit('locate')">
        <AtlasIcon name="crosshair" label="Center on my location" />
      </button>
      <button class="control-button" type="button" aria-label="Fit route" :disabled="!interactive || !routeReady" @click="$emit('fit-route')">
        <AtlasIcon name="route" label="Fit route" />
      </button>
    </section>

    <section class="filter-panel glass-panel">
      <header>
        <div>
          <p class="eyebrow">Map filters</p>
          <h2>Visible categories</h2>
        </div>
        <button class="reset-button" type="button" @click="$emit('reset-filters')">Reset</button>
      </header>

      <p class="filter-copy">
        {{ statusCopy }}
      </p>

      <div class="chip-grid">
        <button
          v-for="category in categories"
          :key="category"
          class="filter-chip"
          :class="[
            `badge-${category}`,
            {
              'is-muted': !activeCategories.includes(category),
            },
          ]"
          type="button"
          @click="$emit('toggle-category', category)"
        >
          <AtlasIcon :name="category === 'other' ? 'pin' : category" :label="categoryLabels[category]" />
          <span>{{ categoryLabels[category] }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import type { SpotCategory } from '@/types';

type TrackingState = 'idle' | 'locating' | 'tracking' | 'denied' | 'unsupported' | 'error';

const props = withDefaults(
  defineProps<{
    categories: SpotCategory[];
    activeCategories: SpotCategory[];
    routeReady?: boolean;
    trackingState?: TrackingState;
    interactive?: boolean;
  }>(),
  {
    routeReady: false,
    trackingState: 'idle',
    interactive: true,
  },
);

defineEmits<{
  (event: 'zoom-in'): void;
  (event: 'zoom-out'): void;
  (event: 'locate'): void;
  (event: 'fit-route'): void;
  (event: 'reset-filters'): void;
  (event: 'toggle-category', category: SpotCategory): void;
}>();

const categoryLabels: Record<SpotCategory, string> = {
  food: 'Food',
  nature: 'Nature',
  nightlife: 'Nightlife',
  culture: 'Culture',
  adventure: 'Adventure',
  shopping: 'Shopping',
  scenic: 'Scenic',
  other: 'Other',
};

const statusCopy = computed(() => {
  switch (props.trackingState) {
    case 'tracking':
      return 'Live GPS is sharing your current position with the map.';
    case 'locating':
      return 'Atlas is locking onto your current coordinates.';
    case 'denied':
      return 'Location access is blocked. You can still explore saved routes and pins.';
    case 'unsupported':
      return 'This browser cannot provide GPS updates, but the map remains fully interactive.';
    case 'error':
      return 'Atlas could not refresh your location yet. Try again after moving into stronger coverage.';
    default:
      return 'Toggle the map down to the categories you want to route and explore.';
  }
});
</script>

<style scoped>
.map-controls {
  position: absolute;
  inset: var(--space-4) var(--space-4) var(--space-4) auto;
  z-index: var(--z-sidebar);
  display: grid;
  align-content: space-between;
  gap: var(--space-4);
  pointer-events: none;
}

.control-stack,
.filter-panel {
  pointer-events: auto;
}

.control-stack {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
}

.control-button,
.reset-button,
.filter-chip {
  border: 1px solid transparent;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    opacity var(--transition-fast);
}

.control-button {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  color: var(--text-primary);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.control-button:hover:not(:disabled),
.control-button:focus-visible,
.reset-button:hover,
.reset-button:focus-visible,
.filter-chip:hover,
.filter-chip:focus-visible {
  transform: translateY(-0.0625rem);
  border-color: var(--border-hover);
  outline: none;
}

.control-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.control-button :deep(.atlas-icon) {
  width: 1.25rem;
  height: 1.25rem;
}

.filter-panel {
  width: min(19rem, calc(100vw - 2rem));
  padding: var(--space-4);
}

.filter-panel header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-1);
  font-size: var(--font-size-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-teal);
}

.filter-panel h2 {
  margin: 0;
  font-size: var(--font-size-h3);
}

.filter-copy {
  margin: var(--space-3) 0 var(--space-4);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-relaxed);
}

.reset-button {
  border-radius: var(--radius-full);
  padding: 0.625rem 0.9rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.chip-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: 0.7rem 0.75rem;
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.filter-chip.is-muted {
  opacity: 0.45;
}

.filter-chip :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
}

@media (max-width: 960px) {
  .map-controls {
    inset: auto var(--space-3) var(--space-3) var(--space-3);
    justify-items: end;
  }

  .filter-panel {
    width: min(100%, 22rem);
  }
}
</style>
