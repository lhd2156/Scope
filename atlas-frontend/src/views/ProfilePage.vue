<template>
  <AppShell>
    <div class="page-container page-stack profile-page" :data-profile-layout="isMobileProfileLayout ? 'mobile' : 'desktop'">
      <article v-if="profileError" class="glass-panel state-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Atlas could not open this profile workspace</h2>
        <p class="section-copy">{{ profileError }}</p>
        <RouterLink class="button button-secondary" to="/friends">Back to your network</RouterLink>
      </article>

      <ProfileWorkspaceSkeleton v-else-if="isLoading" />

      <template v-else-if="profileUser">
        <article v-if="workspaceNotice" class="glass-panel inline-note" role="status">
          <p class="eyebrow">Partial refresh</p>
          <p class="section-copy">{{ workspaceNotice }}</p>
        </article>

        <section class="profile-hero">
          <ProfileHeader
            :user="profileUser"
            :is-current-user="isCurrentUser"
            :primary-action-label="primaryActionLabel"
            :primary-action-to="primaryActionTo"
            :secondary-action-label="secondaryActionLabel"
            :secondary-action-to="secondaryActionTo"
          />

          <ProfileStats
            :user="profileUser"
            :country-count="countryCount"
            :city-count="cityCount"
            :trip-count="collaborativeTrips.length"
            :travel-days="daysTraveled"
            :public-spot-count="authoredSpots.length"
            :average-rating="averageRating"
            :favorite-category="favoriteCategory"
          />
        </section>

        <ProfileMap :spots="mapHighlights" :description="mapDescription" title="Global Footprint" />

        <section class="profile-section">
          <SectionHeading
            eyebrow="Recent adventures"
            title="Recent Adventures"
            description="A premium three-card grid of the collaborative routes shaping this explorer's latest Atlas footprint."
          />

          <div v-if="featuredTrips.length" class="adventure-grid" :data-adventure-layout="isMobileProfileLayout ? 'rail' : 'grid'">
            <ProfileAdventureCard v-for="trip in featuredTrips" :key="trip.id" :trip="trip" />
          </div>
          <EmptyStatePanel
            v-else
            eyebrow="Recent adventures"
            title="No collaborative routes yet"
            description="Once this explorer starts planning or joining shared trips, their recent adventures will appear here."
            icon="route"
            artwork="itinerary"
            heading-level="h3"
          />
        </section>

        <section class="profile-section">
          <SectionHeading
            eyebrow="Pinned highlights"
            title="Public pins with the strongest visual payoff"
            description="A curated strip of the places shaping this explorer's current public Atlas identity."
          />

          <div v-if="featuredSpots.length" class="pin-grid" :data-pin-layout="isMobileProfileLayout ? 'stacked' : 'grid'">
            <SpotCard v-for="spot in featuredSpots" :key="spot.id" :spot="spot" />
          </div>
          <EmptyStatePanel
            v-else
            eyebrow="Pinned highlights"
            title="No public pins yet"
            description="When this explorer publishes places to Atlas, they will appear here first."
            icon="map"
            artwork="profile"
            heading-level="h3"
          />
        </section>
      </template>

      <EmptyStatePanel
        v-else
        alignment="center"
        eyebrow="Profile"
        title="Profile unavailable"
        description="Atlas could not find that explorer yet. Try opening another profile from your network."
        icon="user"
        artwork="profile"
        heading-level="h3"
      >
        <RouterLink class="button button-primary" to="/friends">Back to your network</RouterLink>
      </EmptyStatePanel>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import ProfileAdventureCard from '@/components/profile/ProfileAdventureCard.vue';
import ProfileHeader from '@/components/profile/ProfileHeader.vue';
import ProfileMap from '@/components/profile/ProfileMap.vue';
import ProfileStats from '@/components/profile/ProfileStats.vue';
import ProfileWorkspaceSkeleton from '@/components/profile/ProfileWorkspaceSkeleton.vue';
import SpotCard from '@/components/spots/SpotCard.vue';
import { listUserSpots } from '@/services/spotService';
import { listPublicTrips } from '@/services/tripService';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';
import type { SpotCategory, SpotSummary, Trip, TripSpot, UserProfile } from '@/types';
import { toAsyncErrorMessage } from '@/utils/errors';
import { getInclusiveDaySpan } from '@/utils/formatters';

const PROFILE_MOBILE_BREAKPOINT = 640;

const route = useRoute();
const authStore = useAuthStore();
const userStore = useUserStore();
const profileUser = ref<UserProfile | null>(null);
const isMobileProfileLayout = ref(resolveIsMobileProfileLayout());
const profileSpots = ref<SpotSummary[]>([]);
const profileTrips = ref<Trip[]>([]);
const isLoading = ref(true);
const profileError = ref('');
const workspaceNotice = ref('');

let loadRequestId = 0;

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

function getTripDurationDays(trip: Trip): number {
  return getInclusiveDaySpan(trip.startDate, trip.endDate);
}

function resolveIsMobileProfileLayout(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth <= PROFILE_MOBILE_BREAKPOINT;
}

function syncMobileProfileLayout() {
  isMobileProfileLayout.value = resolveIsMobileProfileLayout();
}

const routeUserId = computed(() => String(route.params.id ?? authStore.currentUser?.id ?? ''));
const isCurrentUser = computed(() => profileUser.value?.id === authStore.currentUser?.id);

const authoredSpots = computed(() =>
  [...profileSpots.value].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
);

const collaborativeTrips = computed(() =>
  [...profileTrips.value].sort((left, right) => new Date(right.startDate).getTime() - new Date(left.startDate).getTime()),
);

const featuredTrips = computed(() => collaborativeTrips.value.slice(0, 3));
const featuredSpots = computed(() => authoredSpots.value.slice(0, 6));

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
const countryCount = computed(() => {
  const countries = new Set(mapHighlights.value.map((spot) => spot.country?.trim().toUpperCase()).filter(Boolean));
  return countries.size || (mapHighlights.value.length ? 1 : 0);
});
const daysTraveled = computed(() => collaborativeTrips.value.reduce((total, trip) => total + getTripDurationDays(trip), 0));
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

const primaryActionLabel = computed(() => (isCurrentUser.value ? 'Edit preferences' : 'Plan a trip'));
const primaryActionTo = computed(() => (isCurrentUser.value ? '/settings' : { path: '/trips/new', query: { friend: routeUserId.value } }));
const secondaryActionLabel = computed(() => (isCurrentUser.value ? 'View friends' : 'Open social graph'));
const secondaryActionTo = computed(() => '/friends');

const mapDescription = computed(() => {
  if (!profileUser.value) {
    return 'Atlas map data is unavailable.';
  }

  const visiblePins = mapHighlights.value.length;
  const cities = cityCount.value;

  if (!visiblePins) {
    return `${profileUser.value.displayName} has not published any public pins yet.`;
  }

  return `${profileUser.value.displayName} has ${visiblePins} visible pin${visiblePins === 1 ? '' : 's'} across ${cities} mapped cit${cities === 1 ? 'y' : 'ies'} and ${countryCount.value} countr${countryCount.value === 1 ? 'y' : 'ies'}.`;
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

onMounted(() => {
  syncMobileProfileLayout();
  window.addEventListener('resize', syncMobileProfileLayout, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncMobileProfileLayout);
});

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
.profile-hero,
.profile-section,
.state-panel,
.inline-note {
  display: grid;
  gap: var(--space-6);
}

.state-panel,
.inline-note {
  padding: var(--space-5);
}

.profile-hero {
  gap: var(--space-4);
  padding-top: clamp(var(--space-6), 4vw, var(--space-8));
}

.adventure-grid,
.pin-grid {
  display: grid;
  gap: var(--space-5);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.eyebrow,
h2,
p {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
  font-weight: var(--font-weight-medium);
}

.state-panel .button {
  width: fit-content;
}

.inline-note {
  gap: var(--space-2);
}

.profile-page[data-profile-layout='mobile'] {
  gap: var(--space-4);
}

.profile-page[data-profile-layout='mobile'] :is(.profile-hero, .profile-section) {
  gap: var(--space-4);
}

.profile-page[data-profile-layout='mobile'] .adventure-grid[data-adventure-layout='rail'] {
  grid-template-columns: none;
  grid-auto-flow: column;
  grid-auto-columns: minmax(17.5rem, 84vw);
  overflow-x: auto;
  padding-inline: var(--space-1);
  padding-bottom: 0.15rem;
  margin-inline: calc(var(--space-1) * -1);
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.profile-page[data-profile-layout='mobile'] .adventure-grid[data-adventure-layout='rail'] > * {
  min-width: 0;
  scroll-snap-align: start;
}

.profile-page[data-profile-layout='mobile'] .pin-grid[data-pin-layout='stacked'] {
  grid-template-columns: 1fr;
}

@media (max-width: 1120px) {
  .adventure-grid,
  .pin-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .pin-grid {
    grid-template-columns: 1fr;
  }
}
</style>
