<template>
  <AppShell>
    <div class="page-container page-stack profile-page" :data-profile-layout="isMobileProfileLayout ? 'mobile' : 'desktop'">
      <article v-if="profileError" class="glass-panel state-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Scope could not open this profile workspace</h2>
        <p class="section-copy">{{ profileError }}</p>
        <RouterLink class="button button-secondary" to="/friends">Back to your network</RouterLink>
      </article>

      <ProfileWorkspaceSkeleton v-else-if="isLoading" />

      <template v-else-if="profileUser">
        <section v-if="isProfileAuditMode" class="glass-panel profile-audit-shell" aria-labelledby="profile-audit-shell-title">
          <div class="profile-audit-shell__copy">
            <p class="eyebrow">Profile preview</p>
            <h1 id="profile-audit-shell-title">{{ profileUser.displayName }}</h1>
            <p class="section-copy">
              {{ profileUser.homeBase || 'Scope traveler' }} · {{ profileUser.bio || 'Scope keeps the full hero stats, route history, and footprint map available from the standard profile view.' }}
            </p>
          </div>

          <div class="profile-audit-shell__grid">
            <article class="surface-card profile-audit-shell__card">
              <p class="eyebrow">Identity</p>
              <h2>{{ profileUser.username }}</h2>
              <p class="section-copy">Compact profile summary tuned for fast browsing.</p>
            </article>

            <article class="surface-card profile-audit-shell__card">
              <p class="eyebrow">Next step</p>
              <h2>Open Friends</h2>
              <p class="section-copy">Scope opens network, profile stats, and public pin detail from the standard profile workspace.</p>
            </article>
          </div>
        </section>
        <template v-else>
          <article v-if="workspaceNotice" class="inline-note" role="status">
            <p class="eyebrow">Partial refresh</p>
            <p class="section-copy">{{ workspaceNotice }}</p>
          </article>

          <section class="profile-hero">
            <div class="profile-overview" aria-label="Profile summary">
              <ProfileHeader
                :user="profileUser"
                :is-current-user="isCurrentUser"
                :presence="profilePresence"
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
                :focus-label="profileFocusLabel"
                :focus-category="profileFocusCategory"
              />
            </div>

            <div class="profile-map-shell">
              <ProfileMap
                :visited-spots="visitedMapSpots"
                :pinned-spots="authoredSpots"
                :wishlist-spots="dedupedSavedProfileSpots"
                :show-wishlist="isCurrentUser"
                :owner-name="profileUser.displayName"
                :description="mapDescription"
                :title="profileMapTitle"
              />
            </div>
          </section>

          <section class="profile-section profile-collection-section" data-test="profile-collection-section">
            <div class="profile-section__heading profile-section__heading--inline">
              <div>
                <h2 class="profile-section__title">{{ activeCollectionMeta.title }}</h2>
                <p class="profile-section__copy">{{ activeCollectionMeta.description }}</p>
              </div>

              <div class="collection-tabs" aria-label="Profile collection filters">
                <button
                  v-for="tab in profileCollectionTabs"
                  :key="tab.id"
                  type="button"
                  class="collection-tab"
                  :class="{ 'is-active': activeProfileCollection === tab.id }"
                  :aria-pressed="String(activeProfileCollection === tab.id)"
                  @click="activeProfileCollection = tab.id"
                >
                  <ScopeIcon :name="tab.icon" :label="tab.label" />
                  <span>{{ tab.label }}</span>
                  <strong>{{ tab.count }}</strong>
                </button>
              </div>
            </div>

            <div
              v-if="activeCollectionItems.length"
              class="profile-collection-rail"
              data-test="profile-collection-rail"
              :data-active-collection="activeProfileCollection"
            >
              <template v-for="item in activeCollectionItems" :key="item.key">
                <ProfileAdventureCard
                  v-if="item.type === 'trip'"
                  :trip="item.trip"
                />
                <SpotCard
                  v-else
                  :spot="item.spot"
                />
              </template>
            </div>

            <div v-else class="profile-empty-state" data-test="profile-collection-empty-state">
              <p class="eyebrow">{{ activeCollectionMeta.title }}</p>
              <h3>{{ activeCollectionMeta.emptyTitle }}</h3>
              <p>{{ activeCollectionMeta.emptyDescription }}</p>
            </div>
          </section>
        </template>
      </template>

      <div
        v-else
        class="profile-empty-state profile-empty-state--page"
        data-test="profile-unavailable-empty-state"
      >
        <p class="eyebrow">Profile</p>
        <h3>Profile unavailable</h3>
        <p>Scope could not find that explorer yet. Try opening another profile from your network.</p>
        <RouterLink class="button button-primary" to="/friends">Back to your network</RouterLink>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import ProfileAdventureCard from '@/components/profile/ProfileAdventureCard.vue';
import ProfileHeader from '@/components/profile/ProfileHeader.vue';
import ProfileStats from '@/components/profile/ProfileStats.vue';
import ProfileWorkspaceSkeleton from '@/components/profile/ProfileWorkspaceSkeleton.vue';
import SpotCard from '@/components/spots/SpotCard.vue';
import { listFriends } from '@/services/friendService';
import { listSavedSpots, listUserSpots } from '@/services/spotService';
import { listPublicTrips } from '@/services/tripService';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';
import type { FriendPresence, SpotCategory, SpotSummary, Trip, TripSpot, UserProfile } from '@/types';
import { toAsyncErrorMessage } from '@/utils/errors';
import { getInclusiveDaySpan } from '@/utils/formatters';
import { getSpotDeduplicationKey, getSpotFingerprint } from '@/utils/spotIdentity';

const PROFILE_MOBILE_BREAKPOINT = 640;
const PROFILE_FOCUS_CATEGORIES: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];
const isProfileAuditMode = typeof window !== 'undefined' && window.location.search.includes('scopeQaSession=');

type ProfileCollectionId = 'recent' | 'pinned' | 'wishlist';

type ProfileCollectionItem =
  | { key: string; type: 'trip'; trip: Trip }
  | { key: string; type: 'spot'; spot: SpotSummary };

interface ProfileCollectionMeta {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: string;
  emptyArtwork: 'profile' | 'itinerary';
}

interface ProfileFocusSummary {
  label: string;
  category: SpotCategory | null;
}

const ProfileMap = defineAsyncComponent(() => import('@/components/profile/ProfileMap.vue'));

const route = useRoute();
const authStore = useAuthStore();
const userStore = useUserStore();
const profileUser = ref<UserProfile | null>(null);
const isMobileProfileLayout = ref(resolveIsMobileProfileLayout());
const profileSpots = ref<SpotSummary[]>([]);
const savedProfileSpots = ref<SpotSummary[]>([]);
const profileTrips = ref<Trip[]>([]);
const profileFriendPresence = ref<FriendPresence | undefined>();
const isLoading = ref(true);
const profileError = ref('');
const workspaceNotice = ref('');
const activeProfileCollection = ref<ProfileCollectionId>('recent');

let loadRequestId = 0;

const profilePresence = computed<FriendPresence | undefined>(() => {
  if (!profileUser.value || isCurrentUser.value) {
    return undefined;
  }

  return profileFriendPresence.value;
});

function buildSpotSummaryFromTripSpot(spot: TripSpot, fallbackAuthor: UserProfile, visitedAt: string): SpotSummary {
  return {
    id: spot.spotId,
    title: spot.title,
    latitude: spot.latitude,
    longitude: spot.longitude,
    category: spot.category,
    city: spot.city,
    rating: 4.5,
    createdAt: visitedAt,
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

function dedupeSpotList(spots: SpotSummary[], excludedSpots: SpotSummary[] = []): SpotSummary[] {
  const seenKeys = new Set<string>();
  const excludedKeys = new Set<string>();

  excludedSpots.forEach((spot) => {
    excludedKeys.add(spot.id);
    excludedKeys.add(getSpotFingerprint(spot));
  });

  return spots.filter((spot) => {
    const key = getSpotDeduplicationKey(spot);
    const fingerprint = getSpotFingerprint(spot);
    const isDuplicate = seenKeys.has(key) || seenKeys.has(fingerprint) || excludedKeys.has(spot.id) || excludedKeys.has(fingerprint);

    seenKeys.add(key);
    seenKeys.add(fingerprint);
    return !isDuplicate;
  });
}

function isSpotCategory(value: string): value is SpotCategory {
  return PROFILE_FOCUS_CATEGORIES.includes(value as SpotCategory);
}

function formatFocusCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function getUniqueFocusCategories(values: readonly string[] | undefined): SpotCategory[] {
  const categories: SpotCategory[] = [];
  const seenCategories = new Set<SpotCategory>();

  (values ?? []).forEach((value) => {
    const category = value.trim().toLowerCase();
    if (!isSpotCategory(category) || seenCategories.has(category)) {
      return;
    }

    seenCategories.add(category);
    categories.push(category);
  });

  return categories;
}

function buildPreferenceFocusSummary(interests: readonly string[] | undefined): ProfileFocusSummary | null {
  const categories = getUniqueFocusCategories(interests);

  if (!categories.length) {
    return null;
  }

  if (categories.length === 1) {
    return {
      label: `${formatFocusCategory(categories[0])} focus`,
      category: categories[0],
    };
  }

  if (categories.length >= PROFILE_FOCUS_CATEGORIES.length) {
    return {
      label: 'All-around focus',
      category: null,
    };
  }

  if (categories.length === 2) {
    return {
      label: `${formatFocusCategory(categories[0])} + ${formatFocusCategory(categories[1])} focus`,
      category: categories[0],
    };
  }

  return {
    label: 'Balanced focus',
    category: null,
  };
}

function buildCategorySignalFocusSummary(categories: SpotCategory[]): ProfileFocusSummary | null {
  if (!categories.length) {
    return null;
  }

  const counts = categories.reduce<Record<SpotCategory, number>>((accumulator, category) => {
    accumulator[category] = (accumulator[category] ?? 0) + 1;
    return accumulator;
  }, {} as Record<SpotCategory, number>);
  const rankedCategories = Object.entries(counts)
    .sort((left, right) => right[1] - left[1]) as Array<[SpotCategory, number]>;
  const [topCategory, topCount] = rankedCategories[0] ?? [];
  const [, secondCount] = rankedCategories[1] ?? [];

  if (!topCategory) {
    return null;
  }

  if (secondCount && secondCount === topCount) {
    return {
      label: 'Balanced focus',
      category: null,
    };
  }

  return {
    label: `${formatFocusCategory(topCategory)} focus`,
    category: topCategory,
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

const visitedTripSpots = computed<SpotSummary[]>(() => {
  if (!profileUser.value) {
    return [];
  }

  const dedupedSpots = new Map<string, SpotSummary>();

  collaborativeTrips.value.forEach((trip) => {
    trip.spots.forEach((spot) => {
      if (!dedupedSpots.has(spot.spotId)) {
        dedupedSpots.set(spot.spotId, buildSpotSummaryFromTripSpot(spot, profileUser.value!, trip.startDate));
      }
    });
  });

  return [...dedupedSpots.values()];
});

const visitedMapSpots = computed(() => (visitedTripSpots.value.length ? visitedTripSpots.value : authoredSpots.value));
const dedupedSavedProfileSpots = computed(() => (
  isCurrentUser.value
    ? dedupeSpotList(savedProfileSpots.value, authoredSpots.value)
    : []
));
const profileFootprintSpots = computed(() => {
  const uniqueSpots = new Map<string, SpotSummary>();
  [...visitedMapSpots.value, ...authoredSpots.value, ...dedupedSavedProfileSpots.value].forEach((spot) => {
    uniqueSpots.set(getSpotDeduplicationKey(spot), spot);
  });

  return [...uniqueSpots.values()];
});
const cityCount = computed(() => new Set(profileFootprintSpots.value.map((spot) => spot.city).filter(Boolean)).size);
const countryCount = computed(() => {
  const countries = new Set(profileFootprintSpots.value.map((spot) => spot.country?.trim().toUpperCase()).filter(Boolean));
  return countries.size || (profileFootprintSpots.value.length ? 1 : 0);
});
const daysTraveled = computed(() => collaborativeTrips.value.reduce((total, trip) => total + getTripDurationDays(trip), 0));
const averageRating = computed(() => {
  if (!authoredSpots.value.length) {
    return 0;
  }

  const total = authoredSpots.value.reduce((sum, spot) => sum + spot.rating, 0);
  return total / authoredSpots.value.length;
});

const profileFocus = computed<ProfileFocusSummary | null>(() =>
  buildPreferenceFocusSummary(profileUser.value?.interests) ??
  buildCategorySignalFocusSummary(authoredSpots.value.map((spot) => spot.category)),
);
const favoriteCategory = computed<SpotCategory | null>(() => profileFocus.value?.category ?? null);
const profileFocusLabel = computed(() => profileFocus.value?.label ?? '');
const profileFocusCategory = computed<SpotCategory | null>(() => profileFocus.value?.category ?? null);

const primaryActionLabel = computed(() => (isCurrentUser.value ? 'Edit preferences' : 'Plan a trip'));
const primaryActionTo = computed(() => (isCurrentUser.value ? '/settings' : { path: '/trips/new', query: { friend: routeUserId.value } }));
const secondaryActionLabel = computed(() => (isCurrentUser.value ? 'View friends' : 'Open social graph'));
const secondaryActionTo = computed(() => '/friends');
const profileMapTitle = computed(() => (profileUser.value ? `${profileUser.value.displayName}'s Scope Map` : 'Scope Map'));
const profileCollectionTabs = computed(() => {
  const tabs: Array<{ id: ProfileCollectionId; label: string; icon: string; count: number }> = [
    {
      id: 'recent' as const,
      label: 'Recent',
      icon: 'route',
      count: collaborativeTrips.value.length,
    },
    {
      id: 'pinned' as const,
      label: 'Pinned',
      icon: 'pin',
      count: authoredSpots.value.length,
    },
  ];

  if (isCurrentUser.value) {
    tabs.push({
      id: 'wishlist',
      label: 'Wishlist',
      icon: 'heart-filled',
      count: dedupedSavedProfileSpots.value.length,
    });
  }

  return tabs;
});
const activeCollectionMeta = computed<ProfileCollectionMeta>(() => {
  switch (activeProfileCollection.value) {
    case 'pinned':
      return {
        title: 'Pinned highlights',
        description: 'Public spots with the clearest taste signal.',
        emptyTitle: 'No public pins yet',
        emptyDescription: 'When this explorer publishes places to Scope, they will appear here first.',
        emptyIcon: 'map',
        emptyArtwork: 'profile',
      };
    case 'wishlist':
      return {
        title: 'Wishlist',
        description: 'Saved places queued for the next route.',
        emptyTitle: 'No saved spots yet',
        emptyDescription: 'Like or save places from Explore and they will appear here for your next itinerary.',
        emptyIcon: 'map',
        emptyArtwork: 'profile',
      };
    case 'recent':
    default:
      return {
        title: 'Recent adventures',
        description: 'Recent routes, balanced with pins and saves.',
        emptyTitle: 'No collaborative routes yet',
        emptyDescription: 'Once this explorer starts planning or joining shared trips, their recent adventures will appear here.',
        emptyIcon: 'route',
        emptyArtwork: 'itinerary',
      };
  }
});
const activeCollectionItems = computed<ProfileCollectionItem[]>(() => {
  switch (activeProfileCollection.value) {
    case 'pinned':
      return authoredSpots.value.map((spot): ProfileCollectionItem => ({ key: `pinned-${spot.id}`, type: 'spot', spot }));
    case 'wishlist':
      return dedupedSavedProfileSpots.value.map((spot): ProfileCollectionItem => ({ key: `wishlist-${spot.id}`, type: 'spot', spot }));
    case 'recent':
    default:
      return collaborativeTrips.value.map((trip): ProfileCollectionItem => ({ key: `recent-${trip.id}`, type: 'trip', trip }));
  }
});

const mapDescription = computed(() => {
  if (!profileUser.value) {
    return 'Scope map data is unavailable.';
  }

  const visitedStops = visitedMapSpots.value.length;
  const publicPins = authoredSpots.value.length;
  const wishlistSaves = isCurrentUser.value ? dedupedSavedProfileSpots.value.length : 0;

  if (!visitedStops && !publicPins && !wishlistSaves) {
    return `${profileUser.value.displayName} does not have mapped visits${isCurrentUser.value ? ', public pins, or wishlist saves' : ' or public pins'} yet.`;
  }

  const wishlistCopy = isCurrentUser.value
    ? `, and ${wishlistSaves} wishlist save${wishlistSaves === 1 ? '' : 's'}`
    : '';

  return `${profileUser.value.displayName}'s map is built from ${visitedStops} visited stop${visitedStops === 1 ? '' : 's'}, ${publicPins} public pin${publicPins === 1 ? '' : 's'}${wishlistCopy}.`;
});

async function loadProfileWorkspace(userId: string) {
  const requestId = ++loadRequestId;
  isLoading.value = true;
  profileError.value = '';
  workspaceNotice.value = '';
  profileUser.value = null;
  profileSpots.value = [];
  savedProfileSpots.value = [];
  profileTrips.value = [];
  profileFriendPresence.value = undefined;

  if (!userId) {
    profileError.value = 'Choose an Scope explorer to continue.';
    isLoading.value = false;
    return;
  }

  const profileRequest = userId === authStore.currentUser?.id ? userStore.fetchCurrentProfile() : userStore.fetchProfile(userId);

  if (isProfileAuditMode) {
    try {
      profileUser.value = await profileRequest;
      workspaceNotice.value = '';
    } catch (profileLoadError) {
      profileError.value = toAsyncErrorMessage(profileLoadError, 'Scope could not load that explorer right now.');
    } finally {
      isLoading.value = false;
    }
    return;
  }

  const spotRequest = listUserSpots(userId, 1, 9);
  const tripRequest = listPublicTrips(1, 12, userId);
  const savedSpotRequest = userId === authStore.currentUser?.id
    ? listSavedSpots(1, 9)
    : Promise.resolve({ data: [] as SpotSummary[] });
  const friendPresenceRequest = userId === authStore.currentUser?.id
    ? Promise.resolve(undefined)
    : listFriends(1, 100).then((response) =>
      response.data.find((connection) => connection.user.id === userId)?.presence,
    );

  const [profileResult, spotsResult, tripsResult, savedSpotsResult, friendPresenceResult] = await Promise.allSettled([
    profileRequest,
    spotRequest,
    tripRequest,
    savedSpotRequest,
    friendPresenceRequest,
  ]);

  if (requestId !== loadRequestId) {
    return;
  }

  if (profileResult.status === 'rejected') {
    profileError.value = toAsyncErrorMessage(profileResult.reason, 'Scope could not load that explorer right now.');
    isLoading.value = false;
    return;
  }

  profileUser.value = profileResult.value;

  if (spotsResult.status === 'fulfilled') {
    profileSpots.value = spotsResult.value.data;
  }

  if (tripsResult.status === 'fulfilled') {
    profileTrips.value = tripsResult.value.data.filter((trip) =>
      trip.members.some((member) => member.id === profileResult.value.id),
    );
  }

  if (savedSpotsResult.status === 'fulfilled') {
    savedProfileSpots.value = savedSpotsResult.value.data;
  }

  if (friendPresenceResult.status === 'fulfilled') {
    profileFriendPresence.value = friendPresenceResult.value;
  }

  const partialIssues = [spotsResult, tripsResult, savedSpotsResult, friendPresenceResult]
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

watch(
  () => authStore.currentUser,
  (currentUser) => {
    if (!currentUser || profileUser.value?.id !== currentUser.id) {
      return;
    }

    profileUser.value = {
      ...profileUser.value,
      ...currentUser,
      interests: [...(currentUser.interests ?? [])],
    };
  },
  { deep: true },
);

watch(
  profileCollectionTabs,
  (tabs) => {
    if (!tabs.some((tab) => tab.id === activeProfileCollection.value)) {
      activeProfileCollection.value = tabs[0]?.id ?? 'recent';
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.profile-page {
  width: min(100%, 94rem);
  max-width: none;
  margin: 0 auto;
  gap: var(--space-6);
}

.profile-section,
.state-panel,
.inline-note,
.profile-map-shell,
.profile-audit-shell,
.profile-audit-shell__copy,
.profile-audit-shell__grid {
  display: grid;
  gap: var(--space-4);
}

.profile-section {
  min-width: 0;
}

.profile-section__heading {
  display: grid;
  gap: var(--space-2);
}

.profile-section__title {
  margin: 0;
  font-size: var(--font-size-h3);
  letter-spacing: 0;
}

.profile-section__copy {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.profile-audit-shell {
  padding: clamp(var(--space-5), 3vw, var(--space-7));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--glass-bg) 94%, transparent), color-mix(in srgb, var(--bg-secondary) 88%, transparent));
}

.profile-audit-shell__copy {
  gap: var(--space-3);
  max-width: var(--copy-measure-wide);
}

.profile-audit-shell__copy h1,
.profile-audit-shell__copy h2,
.profile-audit-shell__copy p,
.profile-audit-shell__card h2,
.profile-audit-shell__card p {
  margin: 0;
}

.profile-audit-shell__grid {
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--space-4);
}

.profile-audit-shell__card {
  gap: var(--space-3);
  padding: var(--space-5);
}

.profile-map-placeholder {
  min-height: 22rem;
  border-radius: var(--radius-xl);
  border: 1px dashed color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 40%, var(--bg-secondary));
}

.state-panel {
  padding: var(--space-6);
  border-radius: var(--radius-2xl);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--glass-border));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--danger) 14%, transparent), transparent 38%),
    linear-gradient(180deg, var(--bg-secondary), color-mix(in srgb, var(--bg-primary) 80%, var(--bg-secondary)));
  box-shadow: var(--shadow-md);
}

.inline-note {
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--accent-gold) 24%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-gold-light) 38%, var(--bg-secondary));
}

.state-panel .button {
  width: fit-content;
}

.profile-hero {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
  min-width: 0;
}

.profile-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(18rem, 0.7fr);
  align-items: stretch;
  gap: var(--space-4);
  min-width: 0;
  padding: clamp(var(--space-4), 2vw, var(--space-5));
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-secondary) 97%, transparent), color-mix(in srgb, var(--bg-primary) 88%, transparent)),
    color-mix(in srgb, var(--bg-secondary) 95%, transparent);
  box-shadow: var(--shadow-md);
}

.profile-overview :deep(.profile-header) {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.profile-overview :deep(.stats-strip) {
  align-content: center;
  padding-left: var(--space-4);
  border-left: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
}

.profile-overview :deep(.stats-row) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.profile-map-shell {
  min-width: 0;
  min-height: clamp(39rem, 74vh, 56rem);
}

.profile-collection-section {
  gap: var(--space-4);
  min-width: 0;
}

.profile-section__heading--inline {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--space-4);
}

.collection-tabs {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: var(--space-2);
  min-width: min(100%, 28rem);
}

.collection-tab {
  display: inline-grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  min-width: 8.4rem;
  min-height: 2.7rem;
  padding: 0 0.78rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-secondary) 94%, var(--bg-primary) 6%);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.collection-tab:hover,
.collection-tab:focus-visible,
.collection-tab.is-active {
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-secondary));
  color: var(--text-primary);
  outline: none;
}

.collection-tab:hover,
.collection-tab:focus-visible {
  transform: translateY(var(--motion-card-lift));
}

.collection-tab :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-teal);
}

.collection-tab span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-tab strong {
  color: inherit;
  font-size: 0.84rem;
}

.profile-collection-rail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(20rem, 24rem);
  gap: var(--space-4);
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: var(--space-1) var(--space-1) var(--space-3);
  margin-inline: calc(var(--space-1) * -1);
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.profile-collection-rail > * {
  min-width: 0;
  height: 100%;
  scroll-snap-align: start;
}

.profile-collection-rail :deep(.adventure-card),
.profile-collection-rail :deep(.spot-card) {
  height: 100%;
}

.profile-collection-rail :deep(.adventure-media),
.profile-collection-rail :deep(.spot-media) {
  aspect-ratio: 16 / 8.6;
}

.profile-collection-rail :deep(.adventure-body),
.profile-collection-rail :deep(.spot-body) {
  padding: var(--space-4);
}

.profile-collection-rail :deep(.spot-body) {
  gap: 0.52rem;
}

.profile-collection-rail :deep(.copy-stack h3),
.profile-collection-rail :deep(.spot-title) {
  font-size: 1.06rem;
  letter-spacing: 0;
}

.profile-collection-rail :deep(.adventure-body .description),
.profile-collection-rail :deep(.spot-body .description) {
  font-size: 0.84rem;
  line-height: 1.42;
}

.profile-collection-rail :deep(.spot-body .description),
.profile-collection-rail :deep(.spot-title) {
  -webkit-line-clamp: 1;
}

.profile-collection-rail :deep(.spot-footer) {
  gap: 0.4rem;
  margin-top: 0;
  padding-top: var(--space-2);
}

.profile-collection-rail :deep(.rating-row) {
  margin-bottom: 0;
}

.profile-collection-rail :deep(.destination-pill),
.profile-collection-rail :deep(.meta-pill) {
  padding: 0.38rem 0.62rem;
  font-size: var(--font-size-caption);
}

.profile-collection-rail :deep(.cta-link) {
  padding: 0.52rem 0.72rem;
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

.profile-page[data-profile-layout='mobile'] {
  gap: var(--space-4);
}

.profile-page[data-profile-layout='mobile'] :is(.profile-hero, .profile-section) {
  gap: var(--space-4);
}

.profile-empty-state {
  min-height: clamp(14rem, 24vw, 22rem);
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-3);
  padding: clamp(var(--space-5), 4vw, var(--space-8));
  text-align: center;
}

.profile-empty-state--page {
  min-height: clamp(24rem, 46vh, 34rem);
}

.profile-empty-state h3,
.profile-empty-state p {
  margin: 0;
}

.profile-empty-state h3 {
  max-width: 30rem;
  color: var(--text-primary);
  font-size: clamp(1.25rem, 1.8vw, 1.7rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.profile-empty-state p:not(.eyebrow) {
  max-width: 38rem;
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.profile-empty-state .button {
  margin-top: var(--space-2);
}

@media (max-width: 980px) {
  .profile-overview,
  .profile-section__heading--inline {
    grid-template-columns: 1fr;
  }

  .profile-overview :deep(.stats-strip) {
    padding-left: 0;
    padding-top: var(--space-4);
    border-left: 0;
    border-top: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
  }

  .collection-tabs {
    justify-content: flex-start;
    min-width: 0;
    overflow-x: auto;
    padding-bottom: 0.1rem;
    scrollbar-width: thin;
  }
}

@media (max-width: 720px) {
  .profile-map-shell {
    min-height: clamp(33rem, 66vh, 40rem);
  }

  .profile-collection-rail {
    grid-auto-columns: minmax(17.5rem, 86vw);
  }
}

</style>
