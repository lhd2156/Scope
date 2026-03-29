<template>
  <section class="trip-detail" v-if="trip">
    <header class="glass-panel trip-hero">
      <div class="trip-hero__media">
        <img v-if="coverImage" :src="coverImage" :alt="trip.title" class="trip-hero__image" />
        <div v-else class="trip-hero__placeholder">
          <span class="hero-pill">{{ trip.destination }}</span>
          <strong>{{ trip.title }}</strong>
        </div>
      </div>

      <div class="trip-hero__copy">
        <div class="trip-hero__topline">
          <span class="hero-pill">{{ trip.destination }}</span>
          <span class="hero-pill">{{ formattedDates }}</span>
        </div>

        <div>
          <h1>{{ trip.title }}</h1>
          <p class="trip-hero__description">{{ trip.description || 'Trip story syncing from Atlas.' }}</p>
        </div>

        <div class="trip-hero__stats">
          <article class="surface-card stat-card">
            <small>Travelers</small>
            <strong>{{ trip.members.length }}</strong>
          </article>
          <article class="surface-card stat-card">
            <small>Stops</small>
            <strong>{{ trip.spots.length }}</strong>
          </article>
          <article class="surface-card stat-card">
            <small>Estimated cost</small>
            <strong>${{ totalCost.toFixed(0) }}</strong>
          </article>
        </div>
      </div>
    </header>

    <div class="trip-detail__grid">
      <TripTimeline :itinerary="displayItinerary" :spots="trip.spots" />
      <MemberList :members="trip.members" />
    </div>

    <ItineraryView :itinerary="displayItinerary" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ItineraryView from '@/components/trips/ItineraryView.vue';
import MemberList from '@/components/trips/MemberList.vue';
import TripTimeline from '@/components/trips/TripTimeline.vue';
import type { Itinerary, Trip } from '@/types';

const props = defineProps<{
  trip: Trip | null;
}>();

const coverImage = computed(() => props.trip?.coverImageUrl ?? props.trip?.spots[0]?.photoUrl ?? null);
const formattedDates = computed(() => (props.trip ? `${formatDate(props.trip.startDate)} – ${formatDate(props.trip.endDate)}` : ''));
const displayItinerary = computed<Itinerary | null>(() => {
  if (!props.trip) {
    return null;
  }

  if (props.trip.itinerary) {
    return props.trip.itinerary;
  }

  const totalEstimatedCost = props.trip.spots.reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);
  return {
    id: `trip-${props.trip.id}-fallback-itinerary`,
    destination: props.trip.destination,
    totalEstimatedCost,
    weatherForecast: 'Forecast syncing from Atlas weather services.',
    days: [
      {
        dayNumber: 1,
        date: props.trip.startDate,
        spots: props.trip.spots,
      },
    ],
  };
});
const totalCost = computed(() => displayItinerary.value?.totalEstimatedCost ?? 0);

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
</script>

<style scoped>
.trip-detail {
  display: grid;
  gap: var(--space-6);
}

.trip-hero {
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
}

.trip-hero__media {
  min-height: 22rem;
  background:
    radial-gradient(circle at top left, var(--accent-gold-light), transparent 35%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.trip-hero__image,
.trip-hero__placeholder {
  width: 100%;
  height: 100%;
}

.trip-hero__image {
  object-fit: cover;
}

.trip-hero__placeholder {
  display: grid;
  place-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  text-align: center;
}

.trip-hero__copy {
  padding: var(--space-6);
  display: grid;
  align-content: start;
  gap: var(--space-5);
}

.trip-hero__topline {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.hero-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 0.85rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  font-size: var(--font-size-small);
}

.trip-hero__copy h1,
.trip-hero__description {
  margin: 0;
}

.trip-hero__description {
  margin-top: var(--space-3);
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.trip-hero__stats,
.trip-detail__grid {
  display: grid;
  gap: var(--space-4);
}

.trip-hero__stats {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.trip-detail__grid {
  grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 0.8fr);
}

.stat-card {
  padding: var(--space-4);
  display: grid;
  gap: var(--space-2);
}

.stat-card small {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

@media (max-width: 1100px) {
  .trip-hero,
  .trip-detail__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .trip-hero__copy {
    padding: var(--space-5);
  }

  .trip-hero__stats {
    grid-template-columns: 1fr;
  }
}
</style>
