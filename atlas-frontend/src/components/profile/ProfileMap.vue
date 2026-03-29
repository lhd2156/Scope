<template>
  <section class="glass-panel profile-map" data-test="profile-map">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Adventure map</p>
        <h2>{{ title }}</h2>
      </div>
      <span class="meta-pill">{{ spots.length }} public pin{{ spots.length === 1 ? '' : 's' }}</span>
    </div>

    <p class="section-copy">{{ description }}</p>

    <div v-if="spots.length" class="map-layout">
      <div class="map-shell">
        <MapView
          :spots="mapPoints"
          :selected-spot-id="activeSpotId"
          :show-location-tracker="false"
          @spot-select="handleSpotSelect"
        />
      </div>

      <div class="spot-list">
        <button
          v-for="spot in spots"
          :key="spot.id"
          type="button"
          class="spot-row surface-card"
          :class="{ active: spot.id === activeSpotId }"
          @click="activeSpotId = spot.id"
        >
          <div class="spot-row__copy">
            <div class="spot-row__topline">
              <span class="badge" :class="`badge-${spot.category}`">{{ formatCategory(spot.category) }}</span>
              <span class="rating-pill">{{ spot.rating.toFixed(1) }}</span>
            </div>
            <strong>{{ spot.title }}</strong>
            <span>{{ spot.city || 'Atlas community pin' }}</span>
          </div>
          <AtlasIcon name="navigation" label="Focus spot" />
        </button>
      </div>
    </div>

    <article v-else class="empty-state surface-card">
      <h3>No public pins yet</h3>
      <p>When this explorer publishes places to Atlas, their map highlights will appear here.</p>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import MapView from '@/components/map/MapView.vue';
import type { MapPoint, SpotCategory, SpotSummary } from '@/types';

const props = withDefaults(
  defineProps<{
    spots: SpotSummary[];
    title?: string;
    description?: string;
  }>(),
  {
    title: 'Mapped public highlights',
    description: 'Recent places this profile surfaced to the Atlas community.',
  },
);

const activeSpotId = ref<string | null>(props.spots[0]?.id ?? null);

const mapPoints = computed<MapPoint[]>(() =>
  props.spots.map((spot) => ({
    id: spot.id,
    title: spot.title,
    latitude: spot.latitude,
    longitude: spot.longitude,
    category: spot.category,
    city: spot.city,
    vibe: spot.vibe,
    rating: spot.rating,
    photoUrl: spot.photoUrl,
  })),
);

watch(
  () => props.spots,
  (nextSpots) => {
    if (!nextSpots.length) {
      activeSpotId.value = null;
      return;
    }

    if (!nextSpots.some((spot) => spot.id === activeSpotId.value)) {
      activeSpotId.value = nextSpots[0].id;
    }
  },
  { immediate: true },
);

function handleSpotSelect(spot: MapPoint) {
  activeSpotId.value = spot.id;
}

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
</script>

<style scoped>
.profile-map {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5);
}

.panel-header,
.spot-row,
.spot-row__topline {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

h2,
h3,
strong,
span,
p {
  margin: 0;
}

.meta-pill,
.rating-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.8rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  font-size: var(--font-size-small);
}

.map-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 0.85fr);
  gap: var(--space-4);
}

.map-shell {
  min-height: 26rem;
  overflow: hidden;
  border-radius: var(--radius-xl);
}

.map-shell :deep(.map-view) {
  min-height: 26rem;
  border-radius: var(--radius-xl);
}

.spot-list {
  display: grid;
  gap: var(--space-3);
  align-content: start;
}

.spot-row {
  width: 100%;
  padding: var(--space-4);
  border: 1px solid var(--border);
  cursor: pointer;
  color: inherit;
  text-align: left;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.spot-row:hover,
.spot-row:focus-visible,
.spot-row.active {
  transform: translateY(-0.0625rem);
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
  outline: none;
}

.spot-row__copy {
  display: grid;
  gap: var(--space-2);
}

.spot-row__copy span:last-child {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.spot-row :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--accent-teal);
}

.empty-state {
  padding: var(--space-5);
  display: grid;
  gap: var(--space-2);
}

.empty-state p {
  color: var(--text-secondary);
}

@media (max-width: 1080px) {
  .map-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .panel-header,
  .spot-row,
  .spot-row__topline {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
