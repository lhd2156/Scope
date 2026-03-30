<template>
  <section class="glass-panel profile-map" data-test="profile-map">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Adventure map</p>
        <h2>{{ title }}</h2>
        <p class="section-copy">{{ description }}</p>
      </div>

      <div class="toggle-row" aria-label="Footprint view mode">
        <button type="button" class="toggle-pill is-active">Visited</button>
        <button type="button" class="toggle-pill" disabled>Wishlist</button>
      </div>
    </div>

    <div v-if="sortedSpots.length" class="footprint-shell">
      <div class="footprint-stage surface-card">
        <svg class="footprint-canvas" viewBox="0 0 1000 540" role="img" :aria-label="canvasAriaLabel">
          <g class="map-grid" aria-hidden="true">
            <line v-for="gridLine in latitudeGrid" :key="`lat-${gridLine}`" x1="0" :y1="gridLine" x2="1000" :y2="gridLine" class="grid-line" />
            <line v-for="gridLine in longitudeGrid" :key="`lng-${gridLine}`" :x1="gridLine" y1="0" :x2="gridLine" y2="540" class="grid-line" />
          </g>

          <g class="map-continents" aria-hidden="true">
            <path v-for="continent in continentPaths" :key="continent.name" :d="continent.d" class="continent-shape" />
          </g>

          <g class="map-connections" aria-hidden="true">
            <path v-for="connection in connectionPaths" :key="connection.id" :d="connection.d" class="connection-path" />
          </g>

          <g class="map-points">
            <g
              v-for="spot in projectedSpots"
              :key="spot.id"
              class="footprint-point"
              :class="{ 'is-active': spot.id === activeSpotId }"
              :aria-label="`Focus ${spot.title}`"
              role="button"
              tabindex="0"
              @click="activateSpot(spot.id)"
              @keydown.enter.prevent="activateSpot(spot.id)"
              @keydown.space.prevent="activateSpot(spot.id)"
            >
              <circle class="point-halo" :cx="spot.x" :cy="spot.y" :r="spot.id === activeSpotId ? 26 : 18" />
              <circle class="point-ring" :cx="spot.x" :cy="spot.y" :r="spot.id === activeSpotId ? 13 : 10" />
              <circle class="point-core" :cx="spot.x" :cy="spot.y" :r="spot.id === activeSpotId ? 7 : 5" />
            </g>
          </g>
        </svg>

        <article class="spotlight-card glass-panel">
          <div class="spotlight-media">
            <LazyImage v-if="selectedSpot?.photoUrl" :src="selectedSpot.photoUrl" :alt="selectedSpot.title" class="spotlight-image" />
            <div v-else class="spotlight-fallback">
              <AtlasIcon name="map" label="Footprint spotlight" />
            </div>
          </div>

          <div v-if="selectedSpot" class="spotlight-copy">
            <div class="spotlight-topline">
              <span class="badge" :class="`badge-${selectedSpot.category}`">{{ formatCategory(selectedSpot.category) }}</span>
              <span class="rating-pill">{{ selectedSpot.rating.toFixed(1) }}</span>
            </div>
            <strong>{{ selectedSpot.title }}</strong>
            <span>{{ selectedSpot.city || 'Atlas community pin' }}</span>
          </div>
        </article>
      </div>

      <div class="footprint-footer">
        <div class="city-cloud" aria-label="Visited places">
          <button
            v-for="spot in sortedSpots"
            :key="`city-${spot.id}`"
            type="button"
            class="city-pill"
            :class="{ 'is-active': spot.id === activeSpotId }"
            @click="activateSpot(spot.id)"
          >
            <span>{{ spot.city || spot.title }}</span>
            <small>{{ spot.title }}</small>
          </button>
        </div>

        <div class="metric-row">
          <span class="metric-pill">{{ sortedSpots.length }} public pin{{ sortedSpots.length === 1 ? '' : 's' }}</span>
          <span class="metric-pill">{{ cityCount }} cit{{ cityCount === 1 ? 'y' : 'ies' }}</span>
          <span class="metric-pill">{{ countryCount }} countr{{ countryCount === 1 ? 'y' : 'ies' }}</span>
        </div>
      </div>
    </div>

    <article v-else class="empty-state surface-card">
      <h3>No public pins yet</h3>
      <p>When this explorer publishes places to Atlas, their global footprint will glow here first.</p>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import type { SpotCategory, SpotSummary } from '@/types';

interface ProjectedSpot extends SpotSummary {
  x: number;
  y: number;
}

interface FootprintConnection {
  id: string;
  d: string;
}

const props = withDefaults(
  defineProps<{
    spots: SpotSummary[];
    title?: string;
    description?: string;
  }>(),
  {
    title: 'Global Footprint',
    description: 'A premium snapshot of the places this explorer has surfaced to Atlas.',
  },
);

const projectionWidth = 1000;
const projectionHeight = 540;
const activeSpotId = ref<string | null>(null);
const continentPaths = [
  {
    name: 'americas',
    d: 'M118 118 C146 78 214 72 252 108 C286 142 290 196 270 228 C288 268 274 324 244 360 C220 390 220 438 188 460 C156 484 104 460 92 416 C82 380 54 344 48 292 C42 246 60 206 84 178 C96 162 102 136 118 118 Z',
  },
  {
    name: 'europe-africa',
    d: 'M470 118 C500 86 556 88 584 118 C606 142 612 174 604 202 C630 236 640 292 624 340 C602 406 542 446 506 434 C478 424 478 374 458 348 C438 320 400 302 398 260 C394 220 426 198 446 176 C456 164 454 136 470 118 Z',
  },
  {
    name: 'asia',
    d: 'M612 126 C646 88 716 82 778 100 C840 120 904 164 920 222 C934 274 908 336 862 360 C818 382 770 370 724 390 C694 402 656 436 620 420 C594 406 590 366 560 346 C530 326 520 292 534 258 C548 224 582 210 600 184 C608 172 600 142 612 126 Z',
  },
  {
    name: 'australia',
    d: 'M786 396 C810 376 854 380 882 402 C908 422 904 454 878 474 C850 494 804 494 780 468 C760 446 764 414 786 396 Z',
  },
];

const sortedSpots = computed(() =>
  [...props.spots].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
);

const projectedSpots = computed<ProjectedSpot[]>(() =>
  sortedSpots.value.map((spot) => ({
    ...spot,
    x: Number((((spot.longitude + 180) / 360) * projectionWidth).toFixed(2)),
    y: Number((((90 - spot.latitude) / 180) * projectionHeight).toFixed(2)),
  })),
);

const connectionPaths = computed<FootprintConnection[]>(() => {
  const orderedSpots = [...projectedSpots.value].reverse();

  return orderedSpots.slice(1).map((spot, index) => {
    const previousSpot = orderedSpots[index];
    const midX = (previousSpot.x + spot.x) / 2;
    const arcHeight = Math.max(46, Math.abs(previousSpot.x - spot.x) * 0.12);
    const controlY = Math.max(54, Math.min(previousSpot.y, spot.y) - arcHeight);

    return {
      id: `${previousSpot.id}-${spot.id}`,
      d: `M ${previousSpot.x} ${previousSpot.y} Q ${midX} ${controlY} ${spot.x} ${spot.y}`,
    };
  });
});

const latitudeGrid = [67.5, 135, 202.5, 270, 337.5, 405, 472.5];
const longitudeGrid = [83.33, 166.67, 250, 333.33, 416.67, 500, 583.33, 666.67, 750, 833.33, 916.67];

const selectedSpot = computed(() => sortedSpots.value.find((spot) => spot.id === activeSpotId.value) ?? sortedSpots.value[0] ?? null);
const cityCount = computed(() => new Set(sortedSpots.value.map((spot) => spot.city).filter(Boolean)).size);
const countryCount = computed(() => {
  const countries = new Set(sortedSpots.value.map((spot) => spot.country?.trim().toUpperCase()).filter(Boolean));
  return countries.size || (sortedSpots.value.length ? 1 : 0);
});
const canvasAriaLabel = computed(() => `${props.title}. ${sortedSpots.value.length} public pins are rendered on the footprint map.`);

watch(
  sortedSpots,
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

function activateSpot(spotId: string) {
  activeSpotId.value = spotId;
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

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.eyebrow,
h2,
h3,
p,
strong,
span,
small {
  margin: 0;
}

.eyebrow {
  margin-bottom: var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

h2 {
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
}

.toggle-row,
.metric-row,
.spotlight-topline,
.footprint-footer {
  display: flex;
  gap: var(--space-3);
}

.toggle-row,
.metric-row {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.toggle-pill,
.metric-pill,
.rating-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.4rem;
  padding: 0.55rem 0.95rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--glass-bg) 100%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.toggle-pill.is-active {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent-teal) 55%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--glass-bg));
  box-shadow: var(--shadow-glow-teal);
}

.toggle-pill:disabled {
  cursor: default;
  opacity: 0.72;
}

.footprint-shell,
.city-pill,
.spotlight-copy {
  display: grid;
  gap: var(--space-3);
}

.footprint-stage {
  position: relative;
  overflow: hidden;
  min-height: 28rem;
  padding: 0;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 36%),
    radial-gradient(circle at bottom right, color-mix(in srgb, var(--accent-gold) 14%, transparent), transparent 34%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.footprint-stage::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 6%, transparent), color-mix(in srgb, var(--bg-primary) 28%, transparent));
  pointer-events: none;
}

.footprint-canvas {
  width: 100%;
  height: 100%;
  min-height: 28rem;
  display: block;
}

.grid-line {
  stroke: color-mix(in srgb, var(--glass-border) 100%, transparent);
  stroke-width: 1;
}

.continent-shape {
  fill: color-mix(in srgb, var(--text-secondary) 12%, transparent);
  stroke: color-mix(in srgb, var(--glass-border) 60%, transparent);
  stroke-width: 2;
}

.connection-path {
  fill: none;
  stroke: color-mix(in srgb, var(--accent-teal) 55%, transparent);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 12 14;
  opacity: 0.9;
}

.footprint-point {
  cursor: pointer;
}

.point-halo,
.point-ring,
.point-core {
  transition: opacity var(--transition-fast), transform var(--transition-fast), stroke var(--transition-fast), fill var(--transition-fast);
  transform-origin: center;
}

.point-halo {
  fill: color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.point-ring {
  fill: color-mix(in srgb, var(--bg-secondary) 92%, transparent);
  stroke: color-mix(in srgb, var(--accent-teal) 85%, transparent);
  stroke-width: 2.5;
}

.point-core {
  fill: var(--accent-teal);
}

.footprint-point:hover .point-halo,
.footprint-point:focus-visible .point-halo,
.footprint-point.is-active .point-halo {
  opacity: 1;
}

.footprint-point.is-active .point-ring,
.footprint-point:hover .point-ring,
.footprint-point:focus-visible .point-ring {
  stroke: color-mix(in srgb, var(--accent-gold) 65%, var(--accent-teal));
}

.footprint-point:focus-visible {
  outline: none;
}

.spotlight-card {
  position: absolute;
  right: var(--space-5);
  bottom: var(--space-5);
  z-index: 1;
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: var(--space-4);
  width: min(22rem, calc(100% - 2.5rem));
  padding: var(--space-4);
}

.spotlight-media {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-xl);
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 36%),
    linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
}

.spotlight-image,
.spotlight-fallback {
  width: 100%;
  height: 100%;
}

.spotlight-image {
  object-fit: cover;
}

.spotlight-fallback {
  display: grid;
  place-items: center;
  color: var(--accent-teal);
}

.spotlight-fallback :deep(.atlas-icon) {
  width: 1.5rem;
  height: 1.5rem;
}

.spotlight-topline {
  align-items: center;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.8rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, currentColor 24%, var(--glass-border));
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.rating-pill {
  color: var(--text-primary);
}

.spotlight-copy strong {
  font-size: var(--font-size-h3);
}

.spotlight-copy span:last-child {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.footprint-footer {
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
}

.city-cloud {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
  gap: var(--space-3);
  flex: 1 1 34rem;
}

.city-pill {
  align-content: start;
  min-height: 4.75rem;
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-secondary) 100%, transparent);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.city-pill:hover,
.city-pill:focus-visible,
.city-pill.is-active {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent-teal) 45%, var(--border));
  box-shadow: var(--shadow-glow-teal);
  background: color-mix(in srgb, var(--accent-teal) 8%, var(--bg-secondary));
  outline: none;
}

.city-pill span {
  font-weight: var(--font-weight-semibold);
}

.city-pill small {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.metric-row {
  flex: 0 0 auto;
}

.empty-state {
  padding: var(--space-5);
  display: grid;
  gap: var(--space-2);
}

.empty-state p {
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .panel-header,
  .footprint-footer {
    flex-direction: column;
  }

  .toggle-row,
  .metric-row {
    justify-content: flex-start;
  }

  .spotlight-card {
    position: static;
    width: calc(100% - (var(--space-5) + var(--space-5)));
    margin: calc(-1 * var(--space-6)) auto var(--space-5);
  }
}

@media (max-width: 720px) {
  .profile-map {
    padding: var(--space-5);
  }

  .city-cloud {
    grid-template-columns: 1fr;
  }

  .spotlight-card {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .footprint-point.is-active .point-halo {
    animation: footprint-pulse 1.8s ease-out infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .point-halo,
  .point-ring,
  .point-core,
  .city-pill {
    transition: none;
  }

  .city-pill:hover,
  .city-pill:focus-visible,
  .city-pill.is-active {
    transform: none;
  }
}

@keyframes footprint-pulse {
  0% {
    opacity: 0.35;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.35;
  }
}
</style>
