<template>
  <section v-if="nearbySpots.length" class="glass-panel nearby-panel">
    <div class="nearby-header">
      <div>
        <p class="eyebrow">Nearby</p>
        <h2>Spots within {{ radiusKm }}km</h2>
      </div>
      <span class="nearby-pill">{{ nearbySpots.length }} found</span>
    </div>

    <div class="nearby-grid stagger-in">
      <RouterLink
        v-for="(spot, index) in nearbySpots"
        :key="spot.id"
        :to="buildSpotPath({ id: spot.id, title: spot.name })"
        class="nearby-card glass-panel"
        :style="{ '--scope-stagger-index': index }"
      >
        <div class="nearby-card__copy">
          <strong>{{ spot.name }}</strong>
          <span v-if="spot._distance_km != null" class="nearby-card__distance">
            {{ spot._distance_km.toFixed(1) }}km away
          </span>
          <div v-if="spot.avg_rating" class="nearby-card__rating">
            <StarRatingDisplay
              :rating="spot.avg_rating"
              :label="`Rated ${spot.avg_rating.toFixed(1)} out of 5`"
              :id-prefix="`nearby-${spot.id}`"
            />
            <span>{{ spot.avg_rating.toFixed(1) }}</span>
          </div>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import { useSearchStore } from '@/stores/search';
import type { SearchResult } from '@/services/searchService';
import { buildSpotPath } from '@/utils/spotRoutes';

const props = withDefaults(
  defineProps<{
    lat?: number;
    lon?: number;
    radiusKm?: number;
    limit?: number;
  }>(),
  {
    radiusKm: 10,
    limit: 8,
  },
);

const searchStore = useSearchStore();
const nearbySpots = ref<SearchResult[]>([]);

async function loadNearby(lat: number, lon: number): Promise<void> {
  await searchStore.nearby(lat, lon, props.radiusKm, props.limit);
  nearbySpots.value = searchStore.geoResults?.results ?? [];
}

onMounted(() => {
  if (props.lat != null && props.lon != null) {
    void loadNearby(props.lat, props.lon);
    return;
  }

  if (!navigator.geolocation) {
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      void loadNearby(position.coords.latitude, position.coords.longitude);
    },
    () => undefined,
    { maximumAge: 300_000, timeout: 6_000 },
  );
});
</script>

<style scoped>
.nearby-panel {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--glass-bg) 94%, transparent), color-mix(in srgb, var(--bg-secondary) 88%, transparent));
}

.nearby-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.nearby-header h2,
.nearby-header p {
  margin: 0;
}

.nearby-pill {
  flex: 0 0 auto;
  padding: 0.55rem 0.85rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.nearby-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
  gap: var(--space-4);
}

.nearby-card {
  padding: var(--space-4);
  color: var(--text-primary);
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.nearby-card:hover,
.nearby-card:focus-visible {
  outline: none;
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--glass-border));
  box-shadow: var(--shadow-md);
}

.nearby-card__copy {
  display: grid;
  gap: var(--space-2);
}

.nearby-card__distance {
  color: var(--accent-teal);
  font-size: var(--font-size-small);
}

.nearby-card__rating {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
}

@media (max-width: 720px) {
  .nearby-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
