<template>
  <AppShell>
    <div class="page-container page-stack friends-page">
      <section class="glass-panel network-shell">
        <div class="network-shell__top">
          <div class="network-shell__copy">
            <p class="eyebrow">Community</p>
            <h1>Build your Atlas travel circle.</h1>
            <p class="section-copy">
              Search your crew, accept incoming requests, and discover travelers whose routes match the way you already explore.
            </p>
          </div>

          <div class="network-shell__stats" aria-label="Friendship metrics">
            <div class="network-stat">
              <strong>{{ friendConnections.length }}</strong>
              <span>Friends connected</span>
            </div>
            <div class="network-stat">
              <strong>{{ onlineCount }}</strong>
              <span>Online right now</span>
            </div>
            <div class="network-stat">
              <strong>{{ friendRequests.length }}</strong>
              <span>Pending requests</span>
            </div>
          </div>
        </div>

        <SearchBar
          v-model="searchQuery"
          class="friends-search"
          aria-label="Search friends"
          label="Search friends"
          placeholder="Search friends, cities, or shared vibes..."
        />

        <div class="tab-row" role="tablist" aria-label="Friend network views">
          <button
            v-for="tab in tabItems"
            :key="tab.id"
            :data-test="`tab-${tab.id}`"
            type="button"
            class="network-tab"
            :class="{ 'is-active': activeTab === tab.id }"
            role="tab"
            :aria-selected="activeTab === tab.id"
            @click="activeTab = tab.id"
          >
            <span>{{ tab.label }}</span>
            <span class="network-tab__count">{{ tab.count }}</span>
          </button>
        </div>
      </section>

      <div class="friends-layout">
        <section class="glass-panel network-panel" data-test="network-panel">
          <header class="panel-header">
            <div>
              <p class="eyebrow">{{ activePanelEyebrow }}</p>
              <h2>{{ activePanelTitle }}</h2>
            </div>
            <p class="section-copy">{{ activePanelDescription }}</p>
          </header>

          <div v-if="activeTab === 'requests' && filteredFriendRequests.length" class="request-grid stagger-in" data-test="requests-grid">
            <article
              v-for="request in filteredFriendRequests"
              :key="request.id"
              class="surface-card request-card"
              data-test="request-card"
            >
              <div class="request-card__cover">
                <LazyImage
                  :src="coverPhotoForCategories(categoriesForUser(request.user))"
                  :alt="`${request.user.displayName} request cover`"
                  class="request-card__cover-image"
                />
                <span class="request-card__badge">Incoming request</span>
              </div>

              <div class="request-card__body">
                <div class="request-card__avatar-shell">
                  <Avatar :name="request.user.displayName" :src="request.user.avatarUrl" :size="64" class="request-card__avatar" />
                </div>

                <div class="request-card__identity">
                  <h3>{{ request.user.displayName }}</h3>
                  <p class="request-card__username">@{{ request.user.username }}</p>
                  <p class="request-card__meta">
                    <AtlasIcon name="pin" />
                    <span>{{ formatLocation(request.user) }}</span>
                  </p>
                </div>

                <p class="request-card__note">{{ request.note || 'Ready to plan a route together.' }}</p>

                <div class="request-card__summary">
                  <span>{{ pluralize(request.mutualFriends, 'mutual friend') }}</span>
                  <span>{{ formatMonthDay(request.createdAt) }}</span>
                </div>

                <div class="request-card__tags">
                  <span
                    v-for="category in categoriesForUser(request.user).slice(0, 2)"
                    :key="`${request.id}-${category}`"
                    class="category-pill"
                    :class="`badge-${category}`"
                  >
                    {{ formatCategory(category) }}
                  </span>
                </div>

                <div class="request-card__actions">
                  <button
                    :data-test="`decline-request-${request.id}`"
                    type="button"
                    class="button button-secondary"
                    @click="declineRequest(request.id)"
                  >
                    Decline
                  </button>
                  <button
                    :data-test="`accept-request-${request.id}`"
                    type="button"
                    class="button button-primary"
                    @click="acceptRequest(request.id)"
                  >
                    Accept
                  </button>
                </div>
              </div>
            </article>
          </div>

          <div v-else-if="activeTab !== 'requests' && filteredFriendConnections.length" class="friend-grid stagger-in" data-test="friends-grid">
            <article
              v-for="connection in filteredFriendConnections"
              :key="connection.id"
              class="surface-card friend-card"
              data-test="friend-card"
            >
              <div class="friend-card__cover">
                <LazyImage
                  :src="coverPhotoForCategories(connection.favoriteCategories)"
                  :alt="`${connection.user.displayName} travel cover`"
                  class="friend-card__cover-image"
                />
                <span class="friend-card__presence-pill" :class="`is-${connection.presence}`">
                  <span class="friend-card__presence-dot" />
                  {{ formatPresence(connection.presence) }}
                </span>
              </div>

              <div class="friend-card__body">
                <div class="friend-card__avatar-shell">
                  <Avatar :name="connection.user.displayName" :src="connection.user.avatarUrl" :size="72" class="friend-card__avatar" />
                  <span class="friend-card__avatar-dot" :class="`is-${connection.presence}`" />
                </div>

                <div class="friend-card__identity">
                  <h3>{{ connection.user.displayName }}</h3>
                  <p class="friend-card__username">@{{ connection.user.username }}</p>
                </div>

                <p class="friend-card__location">
                  <AtlasIcon name="pin" />
                  <span>{{ formatLocation(connection.user) }}</span>
                </p>

                <div class="friend-card__stats">
                  <div>
                    <strong>{{ connection.mutualFriends }}</strong>
                    <span>Mutual friends</span>
                  </div>
                  <div>
                    <strong>{{ connection.sharedTrips }}</strong>
                    <span>Shared trips</span>
                  </div>
                </div>

                <p class="friend-card__adventure">{{ connection.nextAdventure || 'Ready for the next itinerary.' }}</p>

                <div class="friend-card__tags">
                  <span
                    v-for="category in connection.favoriteCategories.slice(0, 2)"
                    :key="`${connection.id}-${category}`"
                    class="category-pill"
                    :class="`badge-${category}`"
                  >
                    {{ formatCategory(category) }}
                  </span>
                </div>

                <button
                  :data-test="`view-profile-${connection.user.id}`"
                  type="button"
                  class="button button-secondary friend-card__action"
                  @click="openProfile(connection.user.id)"
                >
                  View Profile
                </button>
              </div>
            </article>
          </div>

          <EmptyStatePanel
            v-else
            tone="surface"
            eyebrow="Community"
            :title="emptyStateTitle"
            :description="emptyStateDescription"
            icon="friends"
            heading-level="h3"
          >
            <button v-if="searchQuery" type="button" class="button button-secondary" @click="searchQuery = ''">Clear search</button>
          </EmptyStatePanel>
        </section>

        <aside class="glass-panel suggestions-panel" data-test="suggestions-panel">
          <header class="panel-header suggestions-panel__header">
            <div>
              <p class="eyebrow">Suggested</p>
              <h2>People You May Know</h2>
            </div>
            <p class="section-copy">Fresh profiles with overlapping travel taste, strong mutual ties, and premium route energy.</p>
          </header>

          <div v-if="filteredSuggestions.length" class="suggestions-stack stagger-in">
            <article
              v-for="suggestion in filteredSuggestions"
              :key="suggestion.user.id"
              class="surface-card suggestion-card"
              data-test="suggestion-card"
            >
              <div class="suggestion-card__identity">
                <div class="suggestion-card__avatar-shell">
                  <Avatar :name="suggestion.user.displayName" :src="suggestion.user.avatarUrl" :size="56" class="suggestion-card__avatar" />
                </div>

                <div class="suggestion-card__copy">
                  <strong>{{ suggestion.user.displayName }}</strong>
                  <p>@{{ suggestion.user.username }}</p>
                  <p class="suggestion-card__location">
                    <AtlasIcon name="pin" />
                    <span>{{ formatLocation(suggestion.user) }}</span>
                  </p>
                </div>
              </div>

              <p class="suggestion-card__reason">{{ suggestion.reason }}</p>

              <div class="suggestion-card__tags">
                <span
                  v-for="category in suggestion.favoriteCategories.slice(0, 2)"
                  :key="`${suggestion.user.id}-${category}`"
                  class="category-pill"
                  :class="`badge-${category}`"
                >
                  {{ formatCategory(category) }}
                </span>
              </div>

              <div class="suggestion-card__footer">
                <span class="suggestion-card__meta">{{ pluralize(suggestion.mutualFriends, 'mutual friend') }}</span>
                <button
                  :data-test="`view-suggestion-${suggestion.user.id}`"
                  type="button"
                  class="button button-secondary suggestion-card__action"
                  @click="openProfile(suggestion.user.id)"
                >
                  View
                </button>
              </div>
            </article>
          </div>

          <EmptyStatePanel
            v-else
            compact
            tone="surface"
            eyebrow="Suggested"
            title="No fresh matches"
            description="Try a broader search to reveal more travelers who fit your route style."
            icon="search"
            heading-level="h3"
          />
        </aside>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import Avatar from '@/components/common/Avatar.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import SearchBar from '@/components/common/SearchBar.vue';
import { mockFriendConnections, mockFriendRequests, mockPeopleYouMayKnow } from '@/services/mockData';
import type { FriendConnection, FriendPresence, FriendRequest, SpotCategory, UserProfile } from '@/types';
import { formatMonthDay } from '@/utils/formatters';
import { CATEGORY_TRAVEL_PHOTOS } from '@/utils/demoMedia';

type FriendTab = 'all' | 'online' | 'requests';
type SuggestedConnectionEntry = (typeof mockPeopleYouMayKnow)[number];

const SPOT_CATEGORIES: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];

const router = useRouter();
const activeTab = ref<FriendTab>('all');
const searchQuery = ref('');
const friendConnections = ref<FriendConnection[]>([...mockFriendConnections]);
const friendRequests = ref<FriendRequest[]>([...mockFriendRequests.filter((request) => request.direction === 'incoming')]);
const peopleYouMayKnow = ref<SuggestedConnectionEntry[]>([...mockPeopleYouMayKnow]);

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase());
const onlineCount = computed(() => friendConnections.value.filter((connection) => connection.presence === 'online').length);
const tabItems = computed(() => [
  { id: 'all' as const, label: 'All Friends', count: friendConnections.value.length },
  { id: 'online' as const, label: 'Online', count: onlineCount.value },
  { id: 'requests' as const, label: 'Requests', count: friendRequests.value.length },
]);

const filteredFriendConnections = computed(() => {
  const connections = activeTab.value === 'online'
    ? friendConnections.value.filter((connection) => connection.presence === 'online')
    : friendConnections.value;

  return connections.filter((connection) =>
    matchesSearch([
      connection.user.displayName,
      connection.user.username,
      connection.user.homeBase,
      connection.nextAdventure,
      ...connection.favoriteCategories,
    ]),
  );
});

const filteredFriendRequests = computed(() =>
  friendRequests.value.filter((request) =>
    matchesSearch([
      request.user.displayName,
      request.user.username,
      request.user.homeBase,
      request.note,
      ...categoriesForUser(request.user),
    ]),
  ),
);

const filteredSuggestions = computed(() =>
  peopleYouMayKnow.value.filter((suggestion) =>
    matchesSearch([
      suggestion.user.displayName,
      suggestion.user.username,
      suggestion.user.homeBase,
      suggestion.reason,
      ...suggestion.favoriteCategories,
    ]),
  ),
);

const activePanelEyebrow = computed(() => (activeTab.value === 'requests' ? 'Requests' : 'Friends grid'));
const activePanelTitle = computed(() => {
  switch (activeTab.value) {
    case 'online':
      return 'Friends online now';
    case 'requests':
      return 'Pending requests';
    default:
      return 'Your travel circle';
  }
});
const activePanelDescription = computed(() => {
  switch (activeTab.value) {
    case 'online':
      return 'Jump straight into the friends who are active on Atlas right now and likely to respond fast.';
    case 'requests':
      return 'Review new travelers, scan their overlap, and accept the ones who fit your next route.';
    default:
      return 'A premium grid of the people who already shape your trips, city guides, and shared itineraries.';
  }
});
const emptyStateTitle = computed(() => (activeTab.value === 'requests' ? 'No requests match that search' : 'No friends match that search'));
const emptyStateDescription = computed(() =>
  activeTab.value === 'requests'
    ? 'Try another city, name, or vibe to surface the right incoming requests.'
    : 'Adjust the search or switch tabs to reveal more of your Atlas network.',
);

function matchesSearch(values: Array<string | undefined>): boolean {
  if (!normalizedSearchQuery.value) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(normalizedSearchQuery.value));
}

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatLocation(user: UserProfile): string {
  return user.homeBase || 'Atlas traveler';
}

function formatPresence(presence: FriendPresence): string {
  switch (presence) {
    case 'online':
      return 'Online';
    case 'planning':
      return 'Planning';
    default:
      return 'Offline';
  }
}

function pluralize(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function isSpotCategory(value: string): value is SpotCategory {
  return SPOT_CATEGORIES.includes(value as SpotCategory);
}

function categoriesForUser(user: UserProfile): SpotCategory[] {
  const matches = user.interests.filter((interest): interest is SpotCategory => isSpotCategory(interest));
  return matches.length ? matches : ['other'];
}

function coverPhotoForCategories(categories: SpotCategory[]): string {
  return CATEGORY_TRAVEL_PHOTOS[categories[0] ?? 'other'];
}

function openProfile(userId: string): void {
  void router.push(`/profile/${userId}`);
}

function acceptRequest(requestId: string): void {
  const requestIndex = friendRequests.value.findIndex((request) => request.id === requestId);

  if (requestIndex === -1) {
    return;
  }

  const [acceptedRequest] = friendRequests.value.splice(requestIndex, 1);

  friendConnections.value.unshift({
    id: `connection-${acceptedRequest.user.id}`,
    user: acceptedRequest.user,
    presence: 'online',
    sharedTrips: 0,
    mutualFriends: acceptedRequest.mutualFriends,
    favoriteCategories: categoriesForUser(acceptedRequest.user),
    nextAdventure: acceptedRequest.note || 'Ready to map a first route together.',
    lastActiveAt: new Date().toISOString(),
  });

  activeTab.value = 'all';
}

function declineRequest(requestId: string): void {
  friendRequests.value = friendRequests.value.filter((request) => request.id !== requestId);

  if (activeTab.value === 'requests' && !friendRequests.value.length) {
    activeTab.value = 'all';
  }
}
</script>

<style scoped>
.friends-page {
  gap: var(--section-gap);
}

.network-shell,
.network-panel,
.suggestions-panel,
.panel-header,
.network-shell__copy,
.network-stat,
.friend-card,
.friend-card__body,
.friend-card__identity,
.request-card,
.request-card__body,
.request-card__identity,
.suggestion-card,
.suggestion-card__copy,
.suggestions-stack,
.friend-grid,
.request-grid {
  display: grid;
}

.network-shell,
.network-panel,
.suggestions-panel {
  gap: var(--space-5);
  padding: clamp(var(--space-5), 3vw, var(--space-8));
}

.network-shell__top,
.network-shell__stats,
.tab-row,
.friend-card__tags,
.request-card__tags,
.suggestion-card__tags,
.request-card__summary,
.suggestion-card__footer {
  display: flex;
}

.network-shell__top,
.friends-layout {
  gap: var(--space-6);
}

.network-shell__top {
  justify-content: space-between;
  align-items: end;
}

.network-shell__copy {
  gap: var(--space-3);
  max-width: var(--copy-measure-wide);
}

.eyebrow,
.network-shell__copy h1,
.panel-header h2,
.section-copy,
.friend-card__identity h3,
.friend-card__username,
.friend-card__location,
.friend-card__adventure,
.request-card__identity h3,
.request-card__username,
.request-card__meta,
.request-card__note,
.request-card__summary,
.suggestion-card__copy strong,
.suggestion-card__copy p,
.suggestion-card__reason,
.suggestion-card__meta {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.network-shell__copy h1 {
  font-size: var(--font-size-h1);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.panel-header {
  gap: var(--space-2);
}

.panel-header h2 {
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
}

.section-copy,
.friend-card__username,
.friend-card__location,
.friend-card__adventure,
.request-card__username,
.request-card__meta,
.request-card__note,
.request-card__summary,
.suggestion-card__copy p,
.suggestion-card__reason,
.suggestion-card__meta {
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.network-shell__stats {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
}

.network-stat {
  gap: var(--space-1);
  min-width: 9.25rem;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--glass-bg) 88%, transparent);
  box-shadow: var(--shadow-sm);
}

.network-stat strong {
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.network-stat span {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.friends-search {
  width: 100%;
  min-height: 4.25rem;
  padding-inline: var(--space-5);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-md);
}

.friends-search:focus-within {
  box-shadow: var(--shadow-glow-teal);
}

.tab-row {
  flex-wrap: wrap;
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--glass-border);
}

.network-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.4rem 0 0.75rem;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
  transition: color var(--transition-fast), transform var(--transition-fast);
}

.network-tab:hover,
.network-tab:focus-visible {
  color: var(--text-primary);
  transform: translateY(-1px);
  outline: none;
}

.network-tab:active {
  transform: translateY(0) scale(0.97);
}

.network-tab::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  opacity: 0;
  transform: scaleX(0);
  transform-origin: left;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.network-tab.is-active {
  color: var(--text-primary);
}

.network-tab.is-active::after {
  opacity: 1;
  transform: scaleX(1);
}

.network-tab__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal-light) 100%, transparent);
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
}

.friends-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 21rem);
  align-items: start;
}

.friend-grid,
.request-grid {
  gap: var(--space-4);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.friend-card,
.request-card,
.suggestion-card {
  gap: var(--space-4);
  overflow: hidden;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.friend-card:hover,
.friend-card:focus-within,
.request-card:hover,
.request-card:focus-within,
.suggestion-card:hover,
.suggestion-card:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
}

.friend-card__cover,
.request-card__cover {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.friend-card__cover::after,
.request-card__cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-primary) 12%, transparent) 0%,
    color-mix(in srgb, var(--bg-primary) 82%, transparent) 100%
  );
  pointer-events: none;
}

.friend-card__cover-image,
.request-card__cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.friend-card:hover .friend-card__cover-image,
.friend-card:focus-within .friend-card__cover-image,
.request-card:hover .request-card__cover-image,
.request-card:focus-within .request-card__cover-image {
  transform: scale(1.05);
}

.friend-card__presence-pill,
.request-card__badge {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.45rem 0.8rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  font-size: var(--font-size-small);
}

.friend-card__presence-pill {
  color: var(--text-primary);
}

.friend-card__presence-pill.is-online {
  color: var(--success);
}

.friend-card__presence-pill.is-planning {
  color: var(--accent-gold);
}

.friend-card__presence-pill.is-offline {
  color: var(--text-secondary);
}

.friend-card__presence-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: var(--radius-full);
  background: currentColor;
}

.request-card__badge {
  left: var(--space-3);
  right: auto;
  color: var(--text-primary);
}

.friend-card__body,
.request-card__body {
  gap: var(--space-4);
  padding: 0 var(--space-5) var(--space-5);
}

.friend-card__avatar-shell,
.request-card__avatar-shell,
.suggestion-card__avatar-shell {
  position: relative;
  width: fit-content;
  overflow: hidden;
  border-radius: var(--radius-full);
}

.friend-card__avatar-shell,
.request-card__avatar-shell {
  margin-top: calc(var(--space-10) * -0.9);
}

.friend-card__avatar,
.request-card__avatar,
.suggestion-card__avatar {
  border-radius: var(--radius-full);
  border: 2px solid color-mix(in srgb, var(--bg-secondary) 72%, var(--glass-border) 28%);
  background: var(--bg-secondary);
  box-shadow: var(--shadow-md);
}

.friend-card__avatar-shell :deep(img),
.request-card__avatar-shell :deep(img),
.suggestion-card__avatar-shell :deep(img) {
  transition: transform var(--transition-slow);
}

.friend-card:hover .friend-card__avatar-shell :deep(img),
.friend-card:focus-within .friend-card__avatar-shell :deep(img),
.request-card:hover .request-card__avatar-shell :deep(img),
.request-card:focus-within .request-card__avatar-shell :deep(img),
.suggestion-card:hover .suggestion-card__avatar-shell :deep(img),
.suggestion-card:focus-within .suggestion-card__avatar-shell :deep(img) {
  transform: scale(1.06);
}

.friend-card__avatar-dot {
  position: absolute;
  right: 0.25rem;
  bottom: 0.25rem;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: var(--radius-full);
  border: 2px solid var(--bg-secondary);
  background: var(--text-muted);
}

.friend-card__avatar-dot.is-online {
  background: var(--success);
}

.friend-card__avatar-dot.is-planning {
  background: var(--accent-gold);
}

.friend-card__avatar-dot.is-offline {
  background: var(--text-muted);
}

.friend-card__identity,
.request-card__identity,
.suggestion-card__copy {
  gap: var(--space-1);
}

.friend-card__identity h3,
.request-card__identity h3 {
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.friend-card__location,
.request-card__meta,
.suggestion-card__location {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.friend-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.friend-card__stats div {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--glass-border) 72%, var(--border) 28%);
  background: color-mix(in srgb, var(--bg-primary) 76%, transparent);
}

.friend-card__stats strong {
  display: block;
  margin-bottom: var(--space-1);
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.friend-card__stats span {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.friend-card__tags,
.request-card__tags,
.suggestion-card__tags {
  flex-wrap: wrap;
  gap: var(--space-2);
}

.category-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.8rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 70%, transparent);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.06em;
}

.friend-card__action,
.suggestion-card__action {
  width: 100%;
}

.request-card__summary,
.suggestion-card__footer {
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.request-card__summary {
  font-size: var(--font-size-small);
}

.request-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.request-card__actions .button {
  width: 100%;
}

.suggestions-stack {
  gap: var(--space-4);
}

.suggestion-card {
  padding: var(--space-4);
}

.suggestion-card__identity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  align-items: center;
}

.suggestion-card__meta {
  font-size: var(--font-size-small);
}

.suggestion-card__action {
  min-width: 5.5rem;
}

.stagger-in > * {
  opacity: 0;
  transform: translateY(var(--space-4));
  animation: fadeInUp 0.4s ease both;
}

.stagger-in > *:nth-child(1) {
  animation-delay: 0ms;
}

.stagger-in > *:nth-child(2) {
  animation-delay: 100ms;
}

.stagger-in > *:nth-child(3) {
  animation-delay: 200ms;
}

.stagger-in > *:nth-child(4) {
  animation-delay: 300ms;
}

.stagger-in > *:nth-child(n + 5) {
  animation-delay: 400ms;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(var(--space-4));
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1180px) {
  .friends-layout,
  .network-shell__top {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .network-shell__stats {
    justify-content: flex-start;
  }

  .friend-grid,
  .request-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .friend-grid,
  .request-grid,
  .request-card__actions {
    grid-template-columns: 1fr;
  }

  .tab-row,
  .request-card__summary,
  .suggestion-card__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .network-stat,
  .network-tab,
  .suggestion-card__action,
  .friend-card__action {
    width: 100%;
  }

  .network-tab {
    justify-content: space-between;
  }
}

@media (prefers-reduced-motion: reduce) {
  .network-tab,
  .friend-card,
  .request-card,
  .suggestion-card,
  .friend-card__cover-image,
  .request-card__cover-image,
  .friend-card__avatar-shell :deep(img),
  .request-card__avatar-shell :deep(img),
  .suggestion-card__avatar-shell :deep(img) {
    transition-duration: 1ms;
  }

  .network-tab:hover,
  .network-tab:active,
  .friend-card:hover,
  .friend-card:focus-within,
  .request-card:hover,
  .request-card:focus-within,
  .suggestion-card:hover,
  .suggestion-card:focus-within {
    transform: none;
  }

  .stagger-in > * {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
