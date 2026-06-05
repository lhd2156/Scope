<template>
  <div class="map-controls" :class="{ 'map-controls--with-panel': showFilterPanel }">
    <section class="control-stack" data-onboarding-target="map-controls">
      <button class="control-button glass-panel" type="button" aria-label="Zoom in" :disabled="!interactive" @click="$emit('zoom-in')">
        <ScopeIcon name="zoom-in" label="Zoom in" />
      </button>
      <button class="control-button glass-panel" type="button" aria-label="Zoom out" :disabled="!interactive" @click="$emit('zoom-out')">
        <ScopeIcon name="zoom-out" label="Zoom out" />
      </button>
      <button class="control-button glass-panel" type="button" aria-label="Center on my location" :disabled="!interactive" @click="$emit('locate')">
        <ScopeIcon name="crosshair" label="Center on my location" />
      </button>
      <button class="control-button control-button--reset glass-panel" type="button" aria-label="Reset map" @click="$emit('reset-map')">
        <ScopeIcon name="reset" label="Reset map" />
      </button>
      <button
        v-if="showFitRouteControl"
        class="control-button glass-panel"
        type="button"
        aria-label="Fit route"
        :disabled="!interactive || !routeReady"
        @click="$emit('fit-route')"
      >
        <ScopeIcon name="route" label="Fit route" />
      </button>
    </section>

    <section v-if="showFilterPanel" class="filter-panel glass-panel">
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
          <ScopeIcon :name="category === 'other' ? 'pin' : category" :label="categoryLabels[category]" />
          <span>{{ categoryLabels[category] }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import type { SpotCategory } from '@/types';

type TrackingState = 'idle' | 'locating' | 'tracking' | 'denied' | 'unsupported' | 'error';

const props = withDefaults(
  defineProps<{
    categories: SpotCategory[];
    activeCategories: SpotCategory[];
    routeReady?: boolean;
    trackingState?: TrackingState;
    interactive?: boolean;
    showFilterPanel?: boolean;
    showFitRouteControl?: boolean;
  }>(),
  {
    routeReady: false,
    trackingState: 'idle',
    interactive: true,
    showFilterPanel: false,
    showFitRouteControl: true,
  },
);

defineEmits<{
  (event: 'zoom-in'): void;
  (event: 'zoom-out'): void;
  (event: 'locate'): void;
  (event: 'reset-map'): void;
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
  entertainment: 'Entertainment',
  scenic: 'Scenic',
  other: 'Other',
};

const statusCopy = computed(() => {
  switch (props.trackingState) {
    case 'tracking':
      return 'Live GPS is sharing your current position with the map.';
    case 'locating':
      return 'Scope is locking onto your current coordinates.';
    case 'denied':
      return 'Location access is blocked. You can still explore saved routes and pins.';
    case 'unsupported':
      return 'This browser cannot provide GPS updates, but the map remains fully interactive.';
    case 'error':
      return 'Scope could not refresh your location yet. Try again after moving into stronger coverage.';
    default:
      return 'Toggle the map down to the categories you want to route and explore.';
  }
});
</script>

<style scoped>
.map-controls {
  position: absolute;
  top: var(--scope-map-controls-top, auto);
  right: var(--scope-map-controls-right, var(--space-4));
  bottom: var(--scope-map-controls-bottom, var(--space-4));
  left: var(--scope-map-controls-left, auto);
  z-index: var(--scope-map-chrome-z, var(--z-sidebar));
  display: grid;
  justify-items: end;
  align-content: end;
  gap: var(--space-4);
  pointer-events: none;
}

.map-controls--with-panel {
  top: var(--scope-map-controls-panel-top, var(--space-4));
  right: var(--scope-map-controls-panel-right, var(--space-4));
  bottom: var(--scope-map-controls-panel-bottom, var(--space-4));
  left: var(--scope-map-controls-panel-left, auto);
  align-content: space-between;
}

.control-stack,
.filter-panel {
  pointer-events: auto;
}

.control-stack {
  --scope-map-control-button-size: 2.85rem;
  --scope-map-control-rail-padding: 0.5rem;

  display: grid;
  width: max-content;
  height: max-content;
  grid-template-columns: var(--scope-map-control-button-size);
  justify-items: center;
  align-items: center;
  justify-content: center;
  justify-self: end;
  align-self: end;
  gap: 0.55rem;
  padding: var(--scope-map-control-rail-padding);
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 8%, var(--glass-border) 92%);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 82%, transparent);
  box-shadow:
    0 1rem 2.4rem color-mix(in srgb, var(--bg-primary) 30%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.map-controls--with-panel .control-stack {
  align-self: start;
}

.control-stack[data-onboarding-active='true'] {
  padding: var(--space-2);
  border-radius: calc(var(--radius-2xl) + var(--space-2));
  background: color-mix(in srgb, var(--glass-bg) 94%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 20%, transparent),
    0 0 2rem color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.control-stack[data-onboarding-active='true'] .control-button {
  border-color: color-mix(in srgb, var(--accent-teal) 30%, transparent);
  box-shadow:
    var(--shadow-lg),
    0 0 1.4rem color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.control-button,
.reset-button,
.filter-chip {
  border: 1px solid transparent;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    opacity var(--transition-fast);
}

.control-button {
  width: var(--scope-map-control-button-size);
  height: var(--scope-map-control-button-size);
  min-width: var(--scope-map-control-button-size);
  min-height: var(--scope-map-control-button-size);
  padding: 0;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-tertiary) 84%, var(--glass-bg) 16%);
  color: var(--text-primary);
  display: grid;
  place-items: center;
  line-height: 0;
  aspect-ratio: 1;
  appearance: none;
  cursor: pointer;
  box-shadow:
    0 0.45rem 1.1rem color-mix(in srgb, var(--bg-primary) 24%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 8%, transparent);
}

.control-button:hover:not(:disabled),
.control-button:focus-visible,
.reset-button:hover,
.reset-button:focus-visible,
.filter-chip:hover,
.filter-chip:focus-visible {
  transform: translateY(var(--motion-card-lift));
  border-color: var(--border-hover);
  box-shadow: var(--shadow-lg);
  outline: none;
}

.control-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.control-button--reset {
  color: color-mix(in srgb, var(--text-primary) 92%, var(--accent-teal) 8%);
}

.control-button--reset:hover:not(:disabled),
.control-button--reset:focus-visible {
  color: var(--accent-teal);
  border-color: color-mix(in srgb, var(--accent-teal) 28%, var(--border-hover));
}

.control-button:active:not(:disabled),
.reset-button:active,
.filter-chip:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.control-button :deep(.scope-icon) {
  width: 1.08rem;
  height: 1.08rem;
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
  background: color-mix(in srgb, var(--glass-bg) 90%, transparent);
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

.filter-chip:not(.is-muted) {
  border-color: currentColor;
  box-shadow:
    inset 0 0 0 1px currentColor,
    var(--shadow-sm);
}

.filter-chip.is-muted {
  opacity: 0.45;
}

.filter-chip :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

@media (max-width: 960px) {
  .map-controls {
    top: var(--scope-map-controls-top, auto);
    right: var(--scope-map-controls-right, var(--space-3));
    bottom: var(--scope-map-controls-bottom, var(--space-3));
    left: var(--scope-map-controls-left, auto);
  }

  .map-controls--with-panel {
    top: var(--scope-map-controls-panel-top, auto);
    right: var(--scope-map-controls-panel-right, var(--space-3));
    bottom: var(--scope-map-controls-panel-bottom, var(--space-3));
    left: var(--scope-map-controls-panel-left, var(--space-3));
  }

  .control-stack {
    --scope-map-control-button-size: 2.75rem;
  }

  .filter-panel {
    width: min(100%, 22rem);
  }
}

@media (max-width: 640px) {
  .map-controls {
    gap: var(--space-3);
  }

  .control-stack {
    --scope-map-control-button-size: 2.65rem;
    --scope-map-control-rail-padding: 0.45rem;

    gap: 0.5rem;
  }

  .control-button {
    background: color-mix(in srgb, var(--bg-secondary) 94%, var(--bg-primary) 6%);
    box-shadow:
      0 0.8rem 1.6rem color-mix(in srgb, var(--bg-primary) 24%, transparent),
      inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 6%, transparent);
  }

  .control-button :deep(.scope-icon) {
    width: 1.05rem;
    height: 1.05rem;
  }
}
</style>
