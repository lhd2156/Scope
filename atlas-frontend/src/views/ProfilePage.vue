<template>
  <AppShell>
    <div class="page-container page-stack profile-page">
      <SectionHeading
        eyebrow="Profile"
        title="Adventure map and public highlights"
        description="See how each Atlas explorer is showing up across mapped pins, collaborative routes, and the cities shaping their public footprint."
      />

      <template v-if="profileUser">
        <ProfileHeader
          :user="profileUser"
          :is-current-user="isCurrentUser"
          :primary-action-label="primaryActionLabel"
          :primary-action-to="primaryActionTo"
          :secondary-action-label="secondaryActionLabel"
          :secondary-action-to="secondaryActionTo"
        />

        <div class="workspace-grid">
          <div class="main-column">
            <ProfileMap
              :spots="mapHighlights"
              :description="mapDescription"
              title="Pinned places shaping this explorer's map"
            />

            <section class="profile-section">
              <SectionHeading
                eyebrow="Highlights"
                title="Recent public pins"
                description="The newest community-facing places surfaced from this profile's adventure log."
              />

              <div v-if="authoredSpots.length" class="card-grid">
                <SpotCard v-for="spot in authoredSpots" :key="spot.id" :spot="spot" />
              </div>
              <article v-else class="glass-panel empty-panel">
                <h3>No public pins in the current sample</h3>
                <p class="section-copy">This profile has total Atlas stats, but no surfaced public highlights in the seed dataset yet.</p>
              </article>
            </section>

            <section class="profile-section">
              <SectionHeading
                eyebrow="Trips"
                title="Routes built with friends"
                description="Collaborative itineraries where this explorer is active across the current frontend sample."
              />

              <div v-if="profileTrips.length" class="trip-grid">
                <TripCard v-for="trip in profileTrips" :key="trip.id" :trip="trip" />
              </div>
              <article v-else class="glass-panel empty-panel">
                <h3>No collaborative trips yet</h3>
                <p class="section-copy">Once this user joins a shared route, Atlas will surface those itineraries here.</p>
              </article>
            </section>
          </div>

          <aside class="side-column">
            <ProfileStats
              :user="profileUser"
              :public-spot-count="authoredSpots.length"
              :city-count="cityCount"
              :average-rating="averageRating"
              :route-count="profileTrips.length"
              :favorite-category="favoriteCategory"
            />

            <article class="glass-panel insight-panel">
              <div>
                <p class="eyebrow">Collection notes</p>
                <h2>What defines this map</h2>
              </div>

              <p class="section-copy">{{ collectionSummary }}</p>

              <div class="insight-list">
                <div class="surface-card insight-card">
                  <small>Latest public moment</small>
                  <strong>{{ latestMomentTitle }}</strong>
                  <span>{{ latestMomentMeta }}</span>
                </div>
                <div class="surface-card insight-card">
                  <small>Home base</small>
                  <strong>{{ profileUser.homeBase || 'Atlas community' }}</strong>
                  <span>{{ cityCount }} mapped city{{ cityCount === 1 ? '' : 'ies' }} in the visible sample</span>
                </div>
              </div>

              <div class="interest-list">
                <span v-for="interest in profileUser.interests" :key="interest" class="interest-chip" :class="`badge-${interest}`">
                  {{ formatCategory(interest) }}
                </span>
              </div>
            </article>
          </aside>
        </div>
      </template>

      <section v-else class="glass-panel empty-panel">
        <h3>Profile not found</h3>
        <p class="section-copy">The requested explorer isn't present in the current frontend sample data.</p>
        <RouterLink class="button button-primary" to="/friends">Back to your network</RouterLink>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import ProfileHeader from '@/components/profile/ProfileHeader.vue';
import ProfileMap from '@/components/profile/ProfileMap.vue';
import ProfileStats from '@/components/profile/ProfileStats.vue';
import SpotCard from '@/components/spots/SpotCard.vue';
import TripCard from '@/components/trips/TripCard.vue';
import { mockSpots, mockTrips, mockUsers } from '@/services/mockData';
import { useAuthStore } from '@/stores/auth';
import type { SpotCategory, SpotSummary, Trip, TripSpot, UserProfile } from '@/types';

const route = useRoute();
const authStore = useAuthStore();

function uniqueProfiles(users: Array<UserProfile | null | undefined>): UserProfile[] {
  const byId = new Map<string, UserProfile>();

  users.forEach((user) => {
    if (!user) {
      return;
    }

    byId.set(user.id, user);
  });

  return [...byId.values()];
}

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function buildSpotSummaryFromTripSpot(spot: TripSpot, fallbackAuthor: UserProfile): SpotSummary {
  return {
    id: `${spot.spotId}-trip`,
    title: spot.title,
    latitude: spot.latitude,
    longitude: spot.longitude,
    category: spot.category,
    city: spot.city,
    rating: 4.5,
    createdAt: new Date().toISOString(),
    author: fallbackAuthor,
    photoUrl: spot.photoUrl,
    vibe: spot.notes,
  };
}

const routeUserId = computed(() => String(route.params.id ?? authStore.currentUser?.id ?? ''));
const profileDirectory = computed(() => uniqueProfiles([...mockUsers, authStore.currentUser]));
const profileUser = computed(() => profileDirectory.value.find((user) => user.id === routeUserId.value) ?? null);
const isCurrentUser = computed(() => profileUser.value?.id === authStore.currentUser?.id);

const authoredSpots = computed(() =>
  mockSpots
    .filter((spot) => spot.author?.id === profileUser.value?.id)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
);

const profileTrips = computed(() =>
  mockTrips
    .filter((trip) => trip.members.some((member) => member.id === profileUser.value?.id))
    .sort((left, right) => new Date(right.startDate).getTime() - new Date(left.startDate).getTime()),
);

const mapHighlights = computed<SpotSummary[]>(() => {
  if (authoredSpots.value.length) {
    return authoredSpots.value;
  }

  if (!profileUser.value) {
    return [];
  }

  const dedupedSpots = new Map<string, SpotSummary>();

  profileTrips.value.forEach((trip) => {
    trip.spots.forEach((spot) => {
      if (!dedupedSpots.has(spot.spotId)) {
        dedupedSpots.set(spot.spotId, buildSpotSummaryFromTripSpot(spot, profileUser.value!));
      }
    });
  });

  return [...dedupedSpots.values()];
});

const cityCount = computed(() => new Set(mapHighlights.value.map((spot) => spot.city).filter(Boolean)).size);
const averageRating = computed(() => {
  if (!authoredSpots.value.length) {
    return 0;
  }

  const total = authoredSpots.value.reduce((sum, spot) => sum + spot.rating, 0);
  return total / authoredSpots.value.length;
});

const favoriteCategory = computed<SpotCategory | null>(() => {
  const categories = authoredSpots.value.length
    ? authoredSpots.value.map((spot) => spot.category)
    : (profileUser.value?.interests as SpotCategory[] | undefined) ?? [];

  if (!categories.length) {
    return null;
  }

  const counts = categories.reduce<Record<string, number>>((accumulator, category) => {
    accumulator[category] = (accumulator[category] ?? 0) + 1;
    return accumulator;
  }, {});

  const [topCategory] = Object.entries(counts).sort((left, right) => right[1] - left[1])[0] ?? [];
  return (topCategory as SpotCategory | undefined) ?? null;
});

const latestPublicSpot = computed(() => authoredSpots.value[0] ?? null);
const latestTrip = computed<Trip | null>(() => profileTrips.value[0] ?? null);
const latestMomentTitle = computed(() => latestPublicSpot.value?.title ?? latestTrip.value?.title ?? 'No public moments yet');
const latestMomentMeta = computed(() => {
  if (latestPublicSpot.value) {
    return `${latestPublicSpot.value.city || 'Atlas community'} · ${formatCategory(latestPublicSpot.value.category)}`;
  }

  if (latestTrip.value) {
    return `${latestTrip.value.destination} · ${latestTrip.value.members.length} traveler${latestTrip.value.members.length === 1 ? '' : 's'}`;
  }

  return 'Waiting on the next highlight.';
});

const primaryActionLabel = computed(() => (isCurrentUser.value ? 'Edit preferences' : 'Plan a trip'));
const primaryActionTo = computed(() => (isCurrentUser.value ? '/settings' : { path: '/trips/new', query: { friend: routeUserId.value } }));
const secondaryActionLabel = computed(() => (isCurrentUser.value ? 'View friends' : 'Open social graph'));
const secondaryActionTo = computed(() => (isCurrentUser.value ? '/friends' : '/friends'));

const mapDescription = computed(() => {
  if (!profileUser.value) {
    return 'Atlas map data is unavailable.';
  }

  const visiblePins = mapHighlights.value.length;
  const cities = cityCount.value;

  if (!visiblePins) {
    return `${profileUser.value.displayName} has no visible public pins in the current profile sample yet.`;
  }

  return `${profileUser.value.displayName} has ${visiblePins} visible pin${visiblePins === 1 ? '' : 's'} across ${cities} mapped cit${cities === 1 ? 'y' : 'ies'} in the current profile sample.`;
});

const collectionSummary = computed(() => {
  if (!profileUser.value) {
    return 'Profile details are unavailable.';
  }

  const signature = favoriteCategory.value ? formatCategory(favoriteCategory.value) : 'mixed';
  const tripCount = profileTrips.value.length;
  return `${profileUser.value.displayName}'s visible Atlas footprint leans ${signature.toLowerCase()} with ${authoredSpots.value.length} surfaced pin${authoredSpots.value.length === 1 ? '' : 's'} and ${tripCount} collaborative route${tripCount === 1 ? '' : 's'} in the active mock dataset.`;
});
</script>

<style scoped>
.profile-page,
.main-column,
.side-column,
.profile-section,
.insight-panel,
.insight-list {
  display: grid;
  gap: var(--space-6);
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.8fr);
  gap: var(--space-6);
  align-items: start;
}

.trip-grid {
  display: grid;
  gap: var(--space-4);
}

.insight-panel {
  padding: var(--space-5);
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h2,
h3,
small,
strong,
span {
  margin: 0;
}

.insight-list {
  gap: var(--space-4);
}

.insight-card {
  padding: var(--space-4);
  display: grid;
  gap: var(--space-2);
}

.insight-card small,
.insight-card span {
  color: var(--text-secondary);
}

.interest-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.interest-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.empty-panel {
  padding: var(--space-5);
  display: grid;
  gap: var(--space-3);
}

.empty-panel .button {
  width: fit-content;
}

@media (max-width: 1120px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}
</style>
