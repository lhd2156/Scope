<template>
  <section v-if="trip" class="trip-detail page-stack" data-test="trip-detail">
    <header class="glass-panel hero-panel">
      <div class="hero-media">
        <LazyImage :src="heroImageUrl" :fallback-src="heroImageFallback" :alt="trip.title" class="hero-image" eager />
      </div>

      <div class="hero-copy">
        <div class="hero-topline">
          <div>
            <p class="eyebrow">Trip detail</p>
            <h1>{{ trip.title }}</h1>
            <p class="hero-meta">{{ trip.destination }} · {{ dateRangeLabel }}</p>
          </div>
        </div>

        <p class="section-copy">{{ trip.description }}</p>

        <div class="chip-row">
          <span class="detail-chip">{{ totalDays }} day{{ totalDays === 1 ? '' : 's' }}</span>
          <span class="detail-chip">{{ trip.spots.length }} stop{{ trip.spots.length === 1 ? '' : 's' }}</span>
          <span class="detail-chip">{{ trip.members.length }} traveler{{ trip.members.length === 1 ? '' : 's' }}</span>
          <span class="detail-chip">{{ budgetLabel }}</span>
        </div>

        <div class="stats-grid">
          <article class="surface-card stat-card">
            <small>Estimated spend</small>
            <strong>{{ estimatedSpendLabel }}</strong>
          </article>
          <article class="surface-card stat-card">
            <small>Weather outlook</small>
            <strong>{{ weatherLabel }}</strong>
          </article>
          <article class="surface-card stat-card">
            <small>Route intensity</small>
            <strong>{{ routeIntensityLabel }}</strong>
          </article>
        </div>
      </div>
    </header>

    <div class="content-grid">
      <section class="glass-panel panel-section">
        <TripTimeline :itinerary="resolvedItinerary" />
      </section>

      <aside class="side-stack">
        <section class="glass-panel panel-section route-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Map</p>
              <h2>Route preview</h2>
            </div>
            <span class="meta-pill">{{ trip.destination }}</span>
          </div>

          <div class="map-shell">
            <MapView :spots="mapSpots" :route-points="mapSpots" :show-location-tracker="false" />
          </div>
        </section>

        <section class="glass-panel panel-section">
          <MemberList :members="trip.members" />
        </section>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LazyImage from '@/components/common/LazyImage.vue';
import MapView from '@/components/map/MapView.vue';
import MemberList from '@/components/trips/MemberList.vue';
import TripTimeline from '@/components/trips/TripTimeline.vue';
import type { Itinerary, MapPoint, Trip } from '@/types';
import { getTripCoverFallback, resolveTripCoverImageUrl, resolveTripStopPhotoUrl } from '@/utils/demoPhotos';
import { addCalendarDays, formatMonthDay, getInclusiveDaySpan } from '@/utils/formatters';

const props = defineProps<{
  trip: Trip | null;
}>();

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function buildFallbackItinerary(trip: Trip): Itinerary {
  const groupedDays = trip.spots.reduce<Itinerary['days']>((accumulator, spot) => {
    const dayNumber = spot.dayNumber ?? 1;
    let day = accumulator.find((entry) => entry.dayNumber === dayNumber);

    if (!day) {
      day = {
        dayNumber,
        date: addCalendarDays(trip.startDate, dayNumber - 1),
        spots: [],
      };
      accumulator.push(day);
    }

    day.spots.push(spot);
    day.spots.sort((left, right) => (left.timeSlot ?? '').localeCompare(right.timeSlot ?? ''));
    return accumulator;
  }, []);

  return {
    id: `${trip.id}-fallback-itinerary`,
    destination: trip.destination,
    days: groupedDays.sort((left, right) => left.dayNumber - right.dayNumber),
    totalEstimatedCost: trip.spots.reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0),
    weatherForecast: 'Weather syncing from Scope Intel.',
  };
}

const resolvedItinerary = computed(() => {
  if (!props.trip) {
    return null;
  }

  return props.trip.itinerary ?? buildFallbackItinerary(props.trip);
});

const totalDays = computed(() => (props.trip ? getInclusiveDaySpan(props.trip.startDate, props.trip.endDate) : 0));

const dateRangeLabel = computed(() => {
  if (!props.trip) {
    return '';
  }

  const start = formatMonthDay(props.trip.startDate);
  const end = formatMonthDay(props.trip.endDate);
  return start === end ? start : `${start} → ${end}`;
});

const TRIP_DETAIL_HERO_IMAGE_WIDTH = 1200;

const heroImageFallback = computed(() => (props.trip ? getTripCoverFallback(props.trip, TRIP_DETAIL_HERO_IMAGE_WIDTH) : ''));
const heroImageUrl = computed(() => (props.trip ? resolveTripCoverImageUrl(props.trip, TRIP_DETAIL_HERO_IMAGE_WIDTH) : ''));

const budgetLabel = computed(() => {
  if (!props.trip?.budget) {
    return 'Budget TBD';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: props.trip.currency ?? 'USD',
    maximumFractionDigits: 0,
  }).format(props.trip.budget);
});

const estimatedSpendLabel = computed(() => currencyFormatter.format(resolvedItinerary.value?.totalEstimatedCost ?? 0));
const weatherLabel = computed(() => resolvedItinerary.value?.weatherForecast ?? 'Weather syncing');
const routeIntensityLabel = computed(() => {
  const stopCount = props.trip?.spots.length ?? 0;

  if (stopCount >= 5) {
    return 'Packed';
  }

  if (stopCount >= 3) {
    return 'Moderate';
  }

  return 'Relaxed';
});

function flattenItineraryStops(itinerary: Itinerary | undefined): Trip['spots'] {
  return itinerary?.days.flatMap((day) =>
    day.spots.map((spot) => ({
      ...spot,
      dayNumber: spot.dayNumber ?? day.dayNumber,
    })),
  ) ?? [];
}

const routeStops = computed(() => {
  if (!props.trip) {
    return [];
  }

  return props.trip.spots.length ? props.trip.spots : flattenItineraryStops(props.trip.itinerary);
});

const mapSpots = computed<MapPoint[]>(() =>
  routeStops.value.map((spot, index, stops) => ({
    id: spot.spotId,
    title: spot.title,
    latitude: spot.latitude,
    longitude: spot.longitude,
    category: spot.category,
    city: spot.city,
    photoUrl: resolveTripStopPhotoUrl(spot, 1200),
    routeRole: index === 0 ? 'start' : index === stops.length - 1 ? 'end' : 'stop',
  })) ?? [],
);
</script>

<style scoped>
.page-stack,
.hero-copy,
.content-grid,
.side-stack,
.panel-section,
.stats-grid {
  display: grid;
  gap: var(--space-5);
}

.hero-panel {
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
}

.hero-media {
  min-height: 26rem;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 35%),
    radial-gradient(circle at bottom right, var(--accent-gold-light), transparent 35%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-copy,
.panel-section {
  padding: var(--space-6);
}

.content-grid,
.panel-section {
  content-visibility: auto;
  contain-intrinsic-size: 1px 960px;
}

.hero-topline,
.section-heading {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.hero-topline h1,
.section-heading h2,
.section-copy,
.hero-meta,
.stat-card small,
.stat-card strong {
  margin: 0;
}

.hero-meta,
.section-copy,
.stat-card small {
  color: var(--text-secondary);
}

.detail-chip,
.meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  padding: 0.55rem 0.85rem;
  font-size: var(--font-size-small);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.stats-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stat-card {
  padding: var(--space-4);
  display: grid;
  gap: var(--space-2);
}

.stat-card strong {
  color: var(--text-primary);
  font-size: var(--font-size-h3);
}

.content-grid {
  grid-template-columns: minmax(0, 1.1fr) minmax(20rem, 0.9fr);
}

.route-panel {
  align-content: start;
}

.map-shell {
  min-height: 22rem;
  overflow: hidden;
  border-radius: var(--radius-xl);
}

.map-shell :deep(.map-view) {
  min-height: 22rem;
  border-radius: var(--radius-xl);
}

.map-shell :deep(.map-summary),
.map-shell :deep(.map-controls),
.map-shell :deep(.tracker-overlay) {
  display: none;
}

@media (max-width: 1100px) {
  .hero-panel,
  .content-grid,
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .hero-copy,
  .panel-section {
    padding: var(--space-5);
  }

  .hero-topline,
  .section-heading {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
