<template>
  <AppShell>
    <div class="page-container page-stack profile-page">
      <SectionHeading
        eyebrow="Profile"
        title="Adventure map and public highlights"
        description="See how each Atlas explorer shows up across public pins, collaborative routes, and the cities shaping their visible footprint."
      />

      <article v-if="profileError" class="glass-panel state-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Atlas could not open this profile workspace</h2>
        <p class="section-copy">{{ profileError }}</p>
        <RouterLink class="button button-secondary" to="/friends">Back to your network</RouterLink>
      </article>

      <article v-else-if="isLoading" class="glass-panel state-panel" aria-live="polite">
        <p class="eyebrow">Loading</p>
        <h2>Building this explorer view</h2>
        <p class="section-copy">Atlas is gathering public pins, route participation, and profile context.</p>
      </article>

      <template v-else-if="profileUser">
        <article v-if="workspaceNotice" class="glass-panel inline-note" role="status">
          <p class="eyebrow">Partial refresh</p>
          <p class="section-copy">{{ workspaceNotice }}</p>
        </article>

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
                description="The newest community-facing places surfaced from this explorer's Atlas activity."
              />

              <div v-if="authoredSpots.length" class="card-grid">
                <SpotCard v-for="spot in authoredSpots" :key="spot.id" :spot="spot" />
              </div>
              <article v-else class="glass-panel empty-panel">
                <h3>No public pins yet</h3>
                <p class="section-copy">When this explorer publishes places to Atlas, they will appear here first.</p>
              </article>
            </section>

            <section class="profile-section">
              <SectionHeading
                eyebrow="Trips"
                title="Routes built with friends"
                description="Collaborative public itineraries where this explorer appears on the crew."
              />

              <div v-if="collaborativeTrips.length" class="trip-grid">
                <TripCard v-for="trip in collaborativeTrips" :key="trip.id" :trip="trip" />
              </div>
              <article v-else class="glass-panel empty-panel">
                <h3>No collaborative trips yet</h3>
                <p class="section-copy">Atlas will surface public routes here once this explorer joins or publishes one.</p>
              </article>
            </section>
          </div>

          <aside class="side-column">
            <ProfileStats
              :user="profileUser"
              :public-spot-count="authoredSpots.length"
              :city-count="cityCount"
              :average-rating="averageRating"
              :route-count="collaborativeTrips.length"
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
                  <span>{{ cityCount }} mapped city{{ cityCount === 1 ? '' : 'ies' }} in public view</span>
                </div>
              </div>

              <div class="interest-list">
                <span v-for="interest in profileUser.interests" :key="interest" class="interest-chip" :class="`badge-${toBadgeCategory(interest)}`">
                  {{ formatInterest(interest) }}
                </span>
              </div>
            </article>
          </aside>
        </div>
      </template>

      <section v-else class="glass-panel state-panel">
        <h3>Profile unavailable</h3>
        <p class="section-copy">Atlas could not find that explorer yet. Try opening another profile from your network.</p>
        <RouterLink class="button button-primary" to="/friends">Back to your network</RouterLink>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import ProfileHeader from '@/components/profile/ProfileHeader.vue';
import ProfileMap from '@/components/profile/ProfileMap.vue';
import ProfileStats from '@/components/profile/ProfileStats.vue';
import SpotCard from '@/components/spots/SpotCard.vue';
import TripCard from '@/components/trips/TripCard.vue';
import { listUserSpots } from '@/services/spotService';
import { listPublicTrips } from '@/services/tripService';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';
import type { SpotCategory, SpotSummary, Trip, TripSpot, UserProfile } from '@/types';
import { toAsyncErrorMessage } from '@/utils/errors';

const route = useRoute();
const authStore = useAuthStore();
const userStore = useUserStore();
const profileUser = ref<UserProfile | null>(null);
const profileSpots = ref<SpotSummary[]>([]);
const profileTrips = ref<Trip[]>([]);
const isLoading = ref(true);
const profileError = ref('');
const workspaceNotice = ref('');
const availableCategories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];

let loadRequestId = 0;

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function toBadgeCategory(value: string): SpotCategory {
  const normalizedValue = value.trim().toLowerCase();
  return availableCategories.find((category) => category === normalizedValue) ?? 'other';
}

function formatInterest(value: string): string {
  return formatCategory(toBadgeCategory(value));
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
const isCurrentUser = computed(() => profileUser.value?.id === authStore.currentUser?.id);

const authoredSpots = computed(() =>
  [...profileSpots.value].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
);

const collaborativeTrips = computed(() =>
  [...profileTrips.value].sort((left, right) => new Date(right.startDate).getTime() - new Date(left.startDate).getTime()),
);

const mapHighlights = computed<SpotSummary[]>(() => {
  if (authoredSpots.value.length) {
    return authoredSpots.value;
  }

  if (!profileUser.value) {
    return [];
  }

  const dedupedSpots = new Map<string, SpotSummary>();

  collaborativeTrips.value.forEach((trip) => {
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
const latestTrip = computed<Trip | null>(() => collaborativeTrips.value[0] ?? null);
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
    return `${profileUser.value.displayName} has not published any public pins yet.`;
  }

  return `${profileUser.value.displayName} has ${visiblePins} visible pin${visiblePins === 1 ? '' : 's'} across ${cities} mapped cit${cities === 1 ? 'y' : 'ies'}.`;
});

const collectionSummary = computed(() => {
  if (!profileUser.value) {
    return 'Profile details are unavailable.';
  }

  const signature = favoriteCategory.value ? formatCategory(favoriteCategory.value) : 'Mixed';
  const tripCount = collaborativeTrips.value.length;
  return `${profileUser.value.displayName}'s public Atlas footprint leans ${signature.toLowerCase()} with ${authoredSpots.value.length} surfaced pin${authoredSpots.value.length === 1 ? '' : 's'} and ${tripCount} collaborative route${tripCount === 1 ? '' : 's'}.`;
});

async function loadProfileWorkspace(userId: string) {
  const requestId = ++loadRequestId;
  isLoading.value = true;
  profileError.value = '';
  workspaceNotice.value = '';
  profileUser.value = null;
  profileSpots.value = [];
  profileTrips.value = [];

  if (!userId) {
    profileError.value = 'Choose an Atlas explorer to continue.';
    isLoading.value = false;
    return;
  }

  const profileRequest = userId === authStore.currentUser?.id ? userStore.fetchCurrentProfile() : userStore.fetchProfile(userId);
  const spotRequest = listUserSpots(userId, 1, 12);
  const tripRequest = listPublicTrips(1, 24);

  const [profileResult, spotsResult, tripsResult] = await Promise.allSettled([profileRequest, spotRequest, tripRequest]);

  if (requestId !== loadRequestId) {
    return;
  }

  if (profileResult.status === 'rejected') {
    profileError.value = toAsyncErrorMessage(profileResult.reason, 'Atlas could not load that explorer right now.');
    isLoading.value = false;
    return;
  }

  profileUser.value = profileResult.value;

  if (spotsResult.status === 'fulfilled') {
    profileSpots.value = spotsResult.value.data;
  }

  if (tripsResult.status === 'fulfilled') {
    profileTrips.value = tripsResult.value.data.filter((trip) => trip.members.some((member) => member.id === profileResult.value.id));
  }

  const partialIssues = [spotsResult, tripsResult]
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => toAsyncErrorMessage(result.reason, 'One part of the profile workspace is still catching up.'));

  workspaceNotice.value = partialIssues[0] ?? '';
  isLoading.value = false;
}

watch(
  routeUserId,
  (userId) => {
    void loadProfileWorkspace(userId);
  },
  { immediate: true },
);
</script>

<style scoped>
.profile-page,
.main-column,
.side-column,
.profile-section,
.insight-panel,
.insight-list,
.state-panel,
.inline-note {
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

.insight-panel,
.state-panel,
.inline-note {
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
span,
p {
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

.state-panel .button,
.empty-panel .button {
  width: fit-content;
}

.inline-note {
  gap: var(--space-2);
}

@media (max-width: 1120px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}
</style>
