<template>
  <AppShell>
    <div class="page-container page-stack friends-page" :data-friends-layout="isMobileFriendsLayout ? 'mobile' : 'desktop'">
      <PageHero
        eyebrow="Community"
        title="Build your Scope travel circle."
        description="Search your crew, accept incoming requests, and discover travelers whose routes match the way you already explore."
      >
        <template #toolbar>
          <SearchBar
            v-model="searchQuery"
            class="friends-search"
            aria-label="Search friends and Scope members"
            label="Search friends and Scope members"
            placeholder="Search @handle, name, city, or vibe..."
            data-test="main-people-search"
          />
        </template>
      </PageHero>

      <section
        v-if="onlineConnectionsForRail.length && !isSearchingPeople"
        class="online-rail active-friends-rail"
        data-test="friends-online-rail"
        aria-labelledby="active-friends-heading"
      >
        <header class="online-rail__header">
          <div>
            <p class="eyebrow">Active friends</p>
            <h2 id="active-friends-heading">Online or planning</h2>
          </div>
          <span class="online-rail__summary">{{ onlineRailSummary }}</span>
        </header>

        <div class="online-rail__scroll">
          <button
            v-for="connection in onlineConnectionsForRail"
            :key="`rail-${connection.id}`"
            type="button"
            class="online-rail__item"
            :data-test="`online-rail-${connection.user.id}`"
            @click="openProfile(connection.user.id)"
          >
            <span class="online-rail__avatar-ring" :class="`is-${connection.presence}`">
              <Avatar :name="connection.user.displayName" :src="connection.user.avatarUrl" :size="64" />
            </span>
            <span class="online-rail__label">{{ firstName(connection.user.displayName) }}</span>
            <span class="online-rail__status">{{ railPresenceLabel(connection.presence) }}</span>
          </button>
        </div>
      </section>

      <div class="friends-tab-row">
        <TabBar
          v-model="activeTab"
          :tabs="tabItems"
          aria-label="Friend network views"
          variant="pills"
        />
      </div>

      <p v-if="findPeopleError" class="form-error" role="alert" data-test="find-people-error">
        {{ findPeopleError }}
      </p>

      <section class="network-panel" :class="{ 'network-panel--plain-empty': showPlainEmptyState }" data-test="network-panel">
        <header v-if="showPanelHeader" class="panel-title-row">
          <div class="panel-title-row__copy">
            <p class="eyebrow">{{ activePanelEyebrow }}</p>
            <h2>{{ activePanelTitle }}</h2>
            <p class="panel-title-row__description">{{ activePanelDescription }}</p>
          </div>
          <span v-if="activeTabCount > 0" class="panel-title-row__count">{{ activeTabCountLabel }}</span>
        </header>

        <div v-if="activeTab === 'discover' && !isSearchingPeople" class="discover-mode-row" role="group" aria-label="Discover ranking mode">
          <button
            v-for="mode in discoverModes"
            :key="mode.id"
            type="button"
            class="discover-mode-row__button"
            :class="{ 'is-active': discoverMode === mode.id }"
            :aria-pressed="discoverMode === mode.id"
            :disabled="friendsStore.loading"
            @click="selectDiscoverMode(mode.id)"
          >
            {{ mode.label }}
          </button>
        </div>

        <div v-if="isSearchingPeople" class="search-workspace stagger-in" data-test="main-search-results">
          <section v-if="searchFriendMatches.length" class="search-section" aria-labelledby="friend-search-heading">
            <header class="search-section__header">
              <div>
                <p class="eyebrow">Your circle</p>
                <h3 id="friend-search-heading">Friends matching this search</h3>
              </div>
              <span>{{ pluralize(searchFriendMatches.length, 'match') }}</span>
            </header>

            <div class="friend-grid" data-test="friend-search-results">
              <FriendCard
                v-for="connection in searchFriendMatches"
                :key="`search-${connection.id}`"
                :connection="connection"
                @open="openProfile"
                @remove="removeConnection"
              />
            </div>
          </section>

          <section v-if="visibleFindPeopleResults.length" class="search-section" aria-labelledby="member-search-heading">
            <header class="search-section__header">
              <div>
                <p class="eyebrow">Find people</p>
                <h3 id="member-search-heading">Scope members to add</h3>
              </div>
              <span>{{ pluralize(visibleFindPeopleResults.length, 'result') }}</span>
            </header>

            <div class="discover-grid" data-test="find-people-results">
              <SuggestionCard
                v-for="candidate in visibleFindPeopleResults"
                :key="candidate.id"
                :user="candidate"
                :reason="suggestionReasonForUser(candidate.id)"
                :categories="categoriesForUser(candidate)"
                :action-disabled="isFriendActionDisabled(candidate.id)"
                :action-label="friendActionLabel(candidate.id)"
                :view-test-id="`view-candidate-${candidate.id}`"
                :send-test-id="`send-request-${candidate.id}`"
                @open="openProfile"
                @send="sendFriendRequest"
              />
            </div>
          </section>

          <div v-if="isFindPeopleLoading" class="find-people-status" data-test="find-people-loading">
            Searching friends and Scope members...
          </div>

          <div
            v-if="!isFindPeopleLoading && !searchFriendMatches.length && !visibleFindPeopleResults.length"
            class="friends-empty-state friends-empty-state--compact"
            data-test="friends-search-empty"
          >
            <p class="eyebrow">Search</p>
            <h3>No Scope members matched</h3>
            <p>Try another @handle, display name, city, email, or vibe.</p>
          </div>
        </div>

        <div v-else-if="activeTab === 'discover' && visibleDiscoverSuggestions.length" class="discover-grid stagger-in" data-test="discover-grid">
          <SuggestionCard
            v-for="suggestion in visibleDiscoverSuggestions"
            :key="suggestion.id"
            :user="suggestion.user"
            :reason="suggestion.reason"
            :categories="suggestion.favoriteCategories"
            :mutual-friends="suggestion.mutualFriends"
            :shared-interests="suggestion.sharedInterests"
            :action-disabled="isFriendActionDisabled(suggestion.user.id)"
            :action-label="friendActionLabel(suggestion.user.id)"
            :view-test-id="`view-discover-${suggestion.user.id}`"
            :send-test-id="`send-request-${suggestion.user.id}`"
            test-id="discover-card"
            variant="discover"
            @open="openProfile"
            @send="(user) => sendFriendRequest(user)"
          />
        </div>

        <div v-else-if="activeTab === 'requests' && filteredFriendRequests.length" class="request-grid stagger-in" data-test="requests-grid">
          <RequestCard
            v-for="request in filteredFriendRequests"
            :key="request.id"
            :request="request"
            :categories="categoriesForUser(request.user)"
            :saving="friendsStore.saving"
            @open="openProfile"
            @accept="acceptRequest"
            @decline="declineRequest"
          />
        </div>

        <template v-else-if="activeTab !== 'requests' && activeTab !== 'discover' && visibleFriendConnections.length">
          <div class="friend-grid stagger-in" data-test="friends-grid">
            <FriendCard
              v-for="connection in visibleFriendConnections"
              :key="connection.id"
              :connection="connection"
              @open="openProfile"
              @remove="removeConnection"
            />
          </div>

          <nav
            v-if="friendPagination.totalPages > 1"
            class="network-pagination"
            data-test="friends-pagination"
            aria-label="Friends pages"
          >
            <button
              type="button"
              class="network-pagination__button"
              data-test="friends-page-prev"
              :disabled="friendPagination.page <= 1"
              aria-label="Previous friends page"
              @click="goToFriendsPage(friendPagination.page - 1)"
            >
              <ScopeIcon name="arrow-left" />
            </button>
            <span class="network-pagination__status" data-test="friends-page-status">
              Page {{ friendPagination.page }} of {{ friendPagination.totalPages }}
            </span>
            <button
              type="button"
              class="network-pagination__button"
              data-test="friends-page-next"
              :disabled="friendPagination.page >= friendPagination.totalPages"
              aria-label="Next friends page"
              @click="goToFriendsPage(friendPagination.page + 1)"
            >
              <ScopeIcon name="arrow-right" />
            </button>
          </nav>
        </template>

        <div
          v-else
          class="friends-empty-state"
          data-test="friends-empty-state"
        >
          <p class="eyebrow">Community</p>
          <h3>{{ emptyStateTitle }}</h3>
          <p>{{ emptyStateDescription }}</p>
          <button v-if="searchQuery" type="button" class="button button-secondary" @click="searchQuery = ''">Clear search</button>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import Avatar from '@/components/common/Avatar.vue';
import PageHero from '@/components/common/PageHero.vue';
import SearchBar from '@/components/common/SearchBar.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import TabBar, { type TabBarItem } from '@/components/common/TabBar.vue';
import FriendCard from '@/components/friends/FriendCard.vue';
import RequestCard from '@/components/friends/RequestCard.vue';
import SuggestionCard from '@/components/friends/SuggestionCard.vue';
import { trackFriendAdd } from '@/services/analyticsService';
import { useFriendsStore } from '@/stores/friends';
import { useNotificationsStore } from '@/stores/notifications';
import type { FriendPresence, FriendSuggestion, SpotCategory, UserProfile } from '@/types';

type FriendTab = 'all' | 'online' | 'requests' | 'discover';
type DiscoverMode = 'best' | 'mutuals' | 'vibes' | 'random';

const FRIENDS_MOBILE_BREAKPOINT = 720;
const SPOT_CATEGORIES: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];
const FRIENDS_PAGE_SIZE = 6;
const MAX_FIND_RESULTS = 6;
const MIN_FIND_QUERY_LENGTH = 2;
const FIND_DEBOUNCE_MS = 280;
const MAX_ONLINE_RAIL = 10;
const PRESENCE_REFRESH_MS = 45_000;
function shouldAutoRefreshFriends(): boolean {
  const testOverride = typeof window !== 'undefined'
    && (window as Window & { __SCOPE_ENABLE_FRIENDS_PRESENCE_REFRESH__?: boolean }).__SCOPE_ENABLE_FRIENDS_PRESENCE_REFRESH__ === true;

  return testOverride || (import.meta.env.MODE !== 'test' && !import.meta.env.VITEST);
}
const discoverModes: Array<{ id: DiscoverMode; label: string }> = [
  { id: 'best', label: 'Best' },
  { id: 'mutuals', label: 'Mutuals' },
  { id: 'vibes', label: 'Vibes' },
  { id: 'random', label: 'Fresh' },
];
const discoverModeDescriptions: Record<DiscoverMode, string> = {
  best: 'Ranked by mutual friends, shared interests, home-base overlap, and recent activity.',
  mutuals: 'Prioritizes people already connected through your existing travel circle.',
  vibes: 'Prioritizes travelers with overlapping interests, categories, and trip energy.',
  random: 'A fresh pass through available Scope members outside the default ranking.',
};

const router = useRouter();
const route = useRoute();
const friendsStore = useFriendsStore();
const notificationsStore = useNotificationsStore();
const activeTab = ref<FriendTab>('all');
const discoverMode = ref<DiscoverMode>('best');
const searchQuery = ref('');
const findPeopleError = ref('');
const currentFriendsPage = ref(1);
const isMobileFriendsLayout = ref(false);
let findPeopleDebounce: ReturnType<typeof setTimeout> | undefined;
let friendPresenceRefreshTimer: ReturnType<typeof setInterval> | undefined;
let findPeopleRequestId = 0;

const friendConnections = computed(() => friendsStore.rankedConnections);
const friendRequests = computed(() => friendsStore.requests);
const normalizedSearchQuery = computed(() => normalizePeopleQuery(searchQuery.value));
const isSearchingPeople = computed(() => normalizedSearchQuery.value.length >= MIN_FIND_QUERY_LENGTH);
const onlineCount = computed(() => friendsStore.onlineConnections.length);
const tabItems = computed<TabBarItem<FriendTab>[]>(() => [
  { id: 'all', label: 'All Friends', count: friendConnections.value.length },
  { id: 'online', label: 'Online', count: onlineCount.value },
  { id: 'requests', label: 'Requests', count: friendRequests.value.length },
  { id: 'discover', label: 'Discover', count: friendsStore.suggestions.length },
]);

const filteredFriendConnections = computed(() => {
  const connections = activeTab.value === 'online'
    ? friendsStore.onlineConnections
    : friendConnections.value;

  return connections.filter((connection) =>
    matchesSearch([
      connection.user.displayName,
      connection.user.username,
      connection.user.email,
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
      request.user.email,
      request.user.homeBase,
      request.note,
      ...categoriesForUser(request.user),
    ]),
  ),
);

const friendPagination = computed(() => {
  const total = filteredFriendConnections.value.length;
  const totalPages = Math.max(1, Math.ceil(total / FRIENDS_PAGE_SIZE));
  const page = Math.min(Math.max(currentFriendsPage.value, 1), totalPages);
  const start = (page - 1) * FRIENDS_PAGE_SIZE;

  return {
    page,
    total,
    totalPages,
    start,
    end: start + FRIENDS_PAGE_SIZE,
  };
});

const visibleFriendConnections = computed(() =>
  filteredFriendConnections.value.slice(friendPagination.value.start, friendPagination.value.end),
);

const onlineConnectionsForRail = computed(() => friendsStore.onlineConnections.slice(0, MAX_ONLINE_RAIL));
const onlineRailSummary = computed(() => {
  const shownCount = onlineConnectionsForRail.value.length;
  const totalCount = friendsStore.onlineConnections.length;
  return shownCount < totalCount
    ? `${shownCount} of ${pluralize(totalCount, 'active friend')}`
    : pluralize(totalCount, 'active friend');
});

const visibleDiscoverSuggestions = computed(() =>
  friendsStore.suggestions
    .filter((suggestion) => !isAlreadyFriend(suggestion.user.id) && !hasSentRequestTo(suggestion.user.id))
    .slice(0, MAX_FIND_RESULTS),
);
const suggestionByUserId = computed(() => new Map(friendsStore.suggestions.map((suggestion) => [suggestion.user.id, suggestion])));
const searchFriendMatches = computed(() =>
  friendConnections.value
    .filter((connection) =>
      matchesSearch([
        connection.user.displayName,
        connection.user.username,
        connection.user.email,
        connection.user.homeBase,
        connection.nextAdventure,
        ...connection.favoriteCategories,
      ]),
    )
    .slice(0, MAX_FIND_RESULTS),
);
const visibleFindPeopleResults = computed(() => {
  if (!isSearchingPeople.value) {
    return [];
  }

  const candidates = friendsStore.searchResults.length
    ? friendsStore.searchResults
    : visibleDiscoverSuggestions.value
      .map((suggestion) => suggestion.user)
      .filter((candidate) =>
        matchesSearch([
          candidate.displayName,
          candidate.username,
          candidate.email,
          candidate.homeBase,
          ...candidate.interests,
        ]),
      );

  return candidates
    .filter((candidate) => !isAlreadyFriend(candidate.id))
    .slice(0, MAX_FIND_RESULTS);
});

const activeTabCount = computed(() => {
  if (isSearchingPeople.value) {
    return searchFriendMatches.value.length + visibleFindPeopleResults.value.length;
  }
  switch (activeTab.value) {
    case 'online':
      return visibleFriendConnections.value.length;
    case 'requests':
      return filteredFriendRequests.value.length;
    case 'discover':
      return visibleDiscoverSuggestions.value.length;
    default:
      return visibleFriendConnections.value.length;
  }
});
const activeTabCountLabel = computed(() => {
  const count = activeTabCount.value;

  if (isSearchingPeople.value) {
    return pluralize(count, 'result');
  }

  switch (activeTab.value) {
    case 'online':
      return friendPagination.value.totalPages > 1
        ? `${count} of ${filteredFriendConnections.value.length} active friends - page ${friendPagination.value.page} of ${friendPagination.value.totalPages}`
        : pluralize(count, 'active friend');
    case 'requests':
      return pluralize(count, 'request');
    case 'discover':
      return pluralize(count, 'suggestion');
    default:
      return friendPagination.value.totalPages > 1
        ? `${count} of ${filteredFriendConnections.value.length} friends shown - page ${friendPagination.value.page} of ${friendPagination.value.totalPages}`
        : `${count} of ${filteredFriendConnections.value.length} friends shown`;
  }
});

const activePanelEyebrow = computed(() => {
  if (isSearchingPeople.value) {
    return 'People search';
  }

  if (activeTab.value === 'requests') {
    return 'Requests';
  }

  return activeTab.value === 'discover' ? 'Discover' : 'Friends grid';
});
const activePanelTitle = computed(() => {
  if (isSearchingPeople.value) {
    return 'Search friends and Scope members';
  }

  switch (activeTab.value) {
    case 'online':
      return 'Friends online now';
    case 'requests':
      return 'Pending requests';
    case 'discover':
      return `${discoverModes.find((mode) => mode.id === discoverMode.value)?.label ?? 'Best'} suggested travelers`;
    default:
      return 'Your travel circle';
  }
});
const activePanelDescription = computed(() => {
  if (isSearchingPeople.value) {
    return 'Results combine your current friends, real Scope members, and suggested travelers from the same main search bar.';
  }

  switch (activeTab.value) {
    case 'online':
      return 'Jump straight into the friends who are active on Scope right now and likely to respond fast.';
    case 'requests':
      return 'Review new travelers, scan their overlap, and accept the ones who fit your next route.';
    case 'discover':
      return discoverModeDescriptions[discoverMode.value];
    default:
      return 'People already connected to your shared trips, saved places, and city guides.';
  }
});
const emptyStateTitle = computed(() => {
  if (activeTab.value === 'discover') {
    return friendsStore.loading ? 'Loading suggested travelers' : 'No suggestions yet';
  }

  if (activeTab.value === 'requests') {
    return friendRequests.value.length
      ? 'No requests match that search'
      : 'No friend requests yet';
  }

  if (!friendConnections.value.length) {
    return 'Your travel circle is still forming';
  }

  return 'No friends match that search';
});

const emptyStateDescription = computed(() => {
  if (activeTab.value === 'discover') {
    return friendsStore.loading
      ? 'Scope is checking mutuals, shared interests, and nearby route overlap.'
      : 'Try searching by @handle, display name, city, or email to find specific Scope members.';
  }

  if (activeTab.value === 'requests') {
    return friendRequests.value.length
      ? 'Try another city, name, or vibe to surface the right incoming requests.'
      : 'Once other Scope members send you a friend request, they will show up here for you to accept.';
  }

  if (!friendConnections.value.length) {
    return 'Use the main search bar to find real Scope members by @handle, display name, city, email, or shared vibe.';
  }

  return 'Adjust the search or switch tabs to reveal more of your Scope network.';
});

function normalizePeopleQuery(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/^@+/, '');
}

function matchesSearch(values: Array<string | undefined>): boolean {
  if (!normalizedSearchQuery.value) {
    return true;
  }

  return values.some((value) => normalizePeopleQuery(value).includes(normalizedSearchQuery.value));
}

function firstName(displayName: string): string {
  return displayName.split(/\s+/)[0] ?? displayName;
}

function pluralize(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function goToFriendsPage(page: number): void {
  currentFriendsPage.value = Math.min(Math.max(page, 1), friendPagination.value.totalPages);
}

function parseRouteTab(value: unknown): FriendTab | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === 'all' || rawValue === 'online' || rawValue === 'requests' || rawValue === 'discover'
    ? rawValue
    : undefined;
}

function railPresenceLabel(presence: FriendPresence): string {
  switch (presence) {
    case 'planning':
      return 'Planning';
    case 'online':
      return 'Online';
    case 'idle':
      return 'Idle';
    default:
      return 'Active';
  }
}

function isSpotCategory(value: string): value is SpotCategory {
  return SPOT_CATEGORIES.includes(value as SpotCategory);
}

function categoriesForUser(user: UserProfile): SpotCategory[] {
  const matches = user.interests.filter((interest): interest is SpotCategory => isSpotCategory(interest));
  return matches.length ? matches : ['other'];
}

function openProfile(userId: string): void {
  void router.push(`/profile/${userId}`);
}

function recordFriendAddAnalytics(payload: {
  routeName: string;
  source: 'request' | 'search';
  requestId: string;
  userId: string;
  mutualFriends: number;
}): void {
  trackFriendAdd(payload);
}

function hasSentRequestTo(userId: string): boolean {
  return friendsStore.hasSentRequestTo(userId);
}

function isAlreadyFriend(userId: string): boolean {
  return friendsStore.isAlreadyFriend(userId);
}

function isFriendActionDisabled(userId: string): boolean {
  return friendsStore.saving || hasSentRequestTo(userId) || isAlreadyFriend(userId);
}

function friendActionLabel(userId: string): string {
  if (isAlreadyFriend(userId)) {
    return 'Friends';
  }

  if (hasSentRequestTo(userId)) {
    return 'Request sent';
  }

  return 'Send request';
}

function suggestionForUser(userId: string): FriendSuggestion | undefined {
  return suggestionByUserId.value.get(userId);
}

function suggestionReasonForUser(userId: string): string {
  return suggestionForUser(userId)?.reason ?? 'Suggested by shared Scope vibes';
}

async function sendFriendRequest(candidate: UserProfile): Promise<void> {
  if (hasSentRequestTo(candidate.id) || isAlreadyFriend(candidate.id)) {
    return;
  }

  findPeopleError.value = '';

  recordFriendAddAnalytics({
    routeName: 'friends',
    source: 'search',
    requestId: `outgoing-${candidate.id}`,
    userId: candidate.id,
    mutualFriends: suggestionForUser(candidate.id)?.mutualFriends ?? 0,
  });

  try {
    await friendsStore.sendRequest(candidate);
  } catch {
    findPeopleError.value = friendsStore.error ?? 'Scope could not send that request right now.';
    return;
  }
}

async function selectDiscoverMode(mode: DiscoverMode): Promise<void> {
  if (discoverMode.value === mode && friendsStore.suggestions.length) {
    return;
  }

  discoverMode.value = mode;
  findPeopleError.value = '';
  await friendsStore.refreshSuggestions(mode);

  if (friendsStore.error) {
    findPeopleError.value = friendsStore.error;
  }
}

async function runFindPeopleSearch(rawQuery: string): Promise<void> {
  const query = rawQuery.trim();

  if (query.length < MIN_FIND_QUERY_LENGTH) {
    friendsStore.searchResults = [];
    findPeopleError.value = '';
    return;
  }

  const requestId = ++findPeopleRequestId;
  findPeopleError.value = '';

  try {
    await friendsStore.search(query);
    if (requestId !== findPeopleRequestId) {
      return;
    }
  } catch {
    if (requestId !== findPeopleRequestId) {
      return;
    }

    findPeopleError.value = 'Scope could not reach member search right now. Try again in a moment.';
  }
}

const isFindPeopleLoading = computed(() => friendsStore.searching);
const showPlainEmptyState = computed(() => {
  if (isSearchingPeople.value) {
    return !isFindPeopleLoading.value && !searchFriendMatches.value.length && !visibleFindPeopleResults.value.length;
  }

  if (activeTab.value === 'discover') {
    return !visibleDiscoverSuggestions.value.length;
  }

  if (activeTab.value === 'requests') {
    return !filteredFriendRequests.value.length;
  }

  return !visibleFriendConnections.value.length;
});
const showPanelHeader = computed(() => !showPlainEmptyState.value);

function syncMobileFriendsLayout() {
  isMobileFriendsLayout.value = typeof window !== 'undefined' && window.innerWidth <= FRIENDS_MOBILE_BREAKPOINT;
}

function refreshFriendPresenceQuietly(): void {
  void friendsStore.refreshConnections().catch(() => {
    // The foreground error area is reserved for user actions; presence refresh retries on the next tick.
  });
}

function syncVisibleFriendPresence(): void {
  if (!shouldAutoRefreshFriends() || typeof document === 'undefined' || document.visibilityState === 'hidden') {
    return;
  }

  refreshFriendPresenceQuietly();
}

watch(searchQuery, (nextQuery) => {
  if (findPeopleDebounce) {
    clearTimeout(findPeopleDebounce);
  }

  findPeopleDebounce = setTimeout(() => {
    void runFindPeopleSearch(nextQuery);
  }, FIND_DEBOUNCE_MS);
});

watch([activeTab, searchQuery], () => {
  currentFriendsPage.value = 1;
});

watch(
  () => friendPagination.value.totalPages,
  (totalPages) => {
    if (currentFriendsPage.value > totalPages) {
      currentFriendsPage.value = totalPages;
    }
  },
);

watch(
  () => filteredFriendConnections.value.length,
  () => {
    if (currentFriendsPage.value > friendPagination.value.totalPages) {
      currentFriendsPage.value = friendPagination.value.totalPages;
    }
  },
);

function handleVisibilityChange(): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    syncVisibleFriendPresence();
  }
}

function startFriendPresenceRefresh(): void {
  if (!shouldAutoRefreshFriends() || typeof window === 'undefined') {
    return;
  }

  friendPresenceRefreshTimer = window.setInterval(syncVisibleFriendPresence, PRESENCE_REFRESH_MS);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function stopFriendPresenceRefresh(): void {
  if (friendPresenceRefreshTimer) {
    clearInterval(friendPresenceRefreshTimer);
    friendPresenceRefreshTimer = undefined;
  }

  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
}

watch(
  () => route.query.tab,
  (nextTab) => {
    const routeTab = parseRouteTab(nextTab);
    if (routeTab) {
      activeTab.value = routeTab;
    }
  },
  { immediate: true },
);

async function acceptRequest(requestId: string): Promise<void> {
  const acceptedRequest = friendRequests.value.find((request) => request.id === requestId);

  if (!acceptedRequest) {
    return;
  }

  try {
    await friendsStore.acceptRequest(requestId);
  } catch {
    findPeopleError.value = friendsStore.error ?? 'Scope could not accept that request right now.';
    return;
  }

  notificationsStore.addNotification({
    id: `notification-friend-${acceptedRequest.id}`,
    title: 'New Scope friend',
    body: `${acceptedRequest.user.displayName} is now in your Scope travel circle. Start planning the first route together.`,
    isRead: false,
    createdAt: new Date().toISOString(),
    type: 'friend.accepted',
  });

  recordFriendAddAnalytics({
    routeName: 'friends',
    source: 'request',
    requestId: acceptedRequest.id,
    userId: acceptedRequest.user.id,
    mutualFriends: acceptedRequest.mutualFriends,
  });

  activeTab.value = 'all';
}

async function declineRequest(requestId: string): Promise<void> {
  try {
    await friendsStore.rejectRequest(requestId);
  } catch {
    findPeopleError.value = friendsStore.error ?? 'Scope could not decline that request right now.';
    return;
  }

  if (activeTab.value === 'requests' && !friendRequests.value.length) {
    activeTab.value = 'all';
  }
}

async function removeConnection(connectionId: string): Promise<void> {
  try {
    await friendsStore.removeConnection(connectionId);
  } catch {
    findPeopleError.value = friendsStore.error ?? 'Scope could not remove that friend right now.';
  }
}

onMounted(() => {
  syncMobileFriendsLayout();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', syncMobileFriendsLayout, { passive: true });
  }

  void friendsStore.fetchAll().catch(() => {
    findPeopleError.value = friendsStore.error ?? '';
  });
  startFriendPresenceRefresh();
});

onBeforeUnmount(() => {
  if (findPeopleDebounce) {
    clearTimeout(findPeopleDebounce);
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncMobileFriendsLayout);
  }
  stopFriendPresenceRefresh();
});
</script>

<style scoped>
.friends-page {
  gap: var(--section-gap);
}

.friends-page :deep(.page-hero h1) {
  font-size: var(--font-size-h1);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.friends-search {
  width: 100%;
  min-height: 3.75rem;
  flex: 1 1 22rem;
  padding-inline: var(--space-4);
  border-radius: var(--radius-2xl);
  border-color: color-mix(in srgb, var(--glass-border) 80%, transparent);
}

.friends-search:focus-within {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-teal) 45%, var(--glass-border)), var(--shadow-glow-teal);
}

.friends-tab-row {
  position: sticky;
  top: calc(var(--shell-content-top) + var(--space-2));
  z-index: 2;
  display: flex;
  justify-content: flex-start;
  padding: var(--space-2) 0;
}

.network-panel {
  display: grid;
  gap: var(--space-4);
}

.network-panel--plain-empty .panel-title-row {
  justify-content: center;
  text-align: center;
}

.network-panel--plain-empty .panel-title-row__description {
  margin-inline: auto;
}

.panel-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.panel-title-row__copy {
  display: grid;
  gap: var(--space-1);
}

.panel-title-row h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0;
  color: var(--text-primary);
}

.panel-title-row__description {
  max-width: 48rem;
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.panel-title-row__count {
  display: inline-grid;
  place-items: center;
  min-width: max-content;
  padding: 0.28rem 0.65rem;
  min-height: 1.6rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-tertiary));
  color: var(--accent-teal);
  font-size: 0.72rem;
  font-weight: var(--font-weight-bold);
}

.friend-grid {
  display: grid;
  gap: var(--space-5);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
}

.request-grid,
.discover-grid {
  display: grid;
  gap: var(--space-5);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.search-workspace,
.search-section {
  display: grid;
  gap: var(--space-5);
}

.search-section__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
}

.search-section__header h3 {
  margin: 0;
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.search-section__header > span {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.online-rail {
  display: grid;
  grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 94%, transparent);
}

.active-friends-rail {
  margin-top: calc(var(--section-gap) * -0.45);
}

.online-rail__header {
  display: grid;
  align-content: center;
  gap: var(--space-1);
}

.online-rail__header h2 {
  margin: 0;
  font-size: 1rem;
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.online-rail__summary {
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
}

.online-rail__scroll {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
  padding-block: 0;
  scrollbar-width: thin;
}

.online-rail__scroll::-webkit-scrollbar {
  height: 0.35rem;
}

.online-rail__item {
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  flex: 0 0 6.35rem;
  min-width: 0;
  padding: var(--space-2) var(--space-1);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    transform var(--transition-fast);
}

.online-rail__item:hover,
.online-rail__item:focus-visible {
  outline: none;
  transform: translateY(-2px);
  border-color: transparent;
  background: transparent;
}

.online-rail__avatar-ring {
  display: inline-grid;
  place-items: center;
  padding: 3px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--success), var(--accent-teal));
  transition:
    outline-color var(--transition-fast),
    transform var(--transition-fast);
}

.online-rail__item:hover .online-rail__avatar-ring {
  transform: scale(1.04);
}

.online-rail__item:focus-visible .online-rail__avatar-ring {
  outline: 2px solid color-mix(in srgb, var(--accent-teal) 58%, transparent);
  outline-offset: 4px;
}

.online-rail__avatar-ring.is-planning {
  background: linear-gradient(135deg, var(--accent-gold), var(--accent-teal));
}

.online-rail__avatar-ring.is-idle {
  background: linear-gradient(135deg, var(--warning), var(--accent-teal));
}

.online-rail__avatar-ring.is-offline,
.online-rail__avatar-ring.is-hidden {
  background: color-mix(in srgb, var(--text-secondary) 35%, transparent);
}

.online-rail__label {
  font-size: 0.88rem;
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.online-rail__status {
  max-width: 100%;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 0.74rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discover-mode-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.discover-mode-row__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.2rem;
  padding: 0.45rem 0.85rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 68%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.discover-mode-row__button:hover,
.discover-mode-row__button:focus-visible,
.discover-mode-row__button.is-active {
  outline: none;
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 15%, var(--bg-secondary));
  color: var(--text-primary);
}

.discover-mode-row__button[disabled] {
  cursor: wait;
  opacity: 0.72;
}

.network-pagination {
  display: inline-flex;
  align-items: center;
  justify-self: center;
  gap: var(--space-2);
  padding: 0.35rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 78%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 72%, transparent);
}

.network-pagination__button {
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 28%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 11%, transparent);
  color: var(--accent-teal);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.network-pagination__button:hover,
.network-pagination__button:focus-visible {
  outline: none;
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 54%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.network-pagination__button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  transform: none;
}

.network-pagination__button :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.network-pagination__status {
  min-width: 5.8rem;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  text-align: center;
}

.find-people-status {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  text-align: center;
  padding: var(--space-3) 0;
}

.friends-empty-state {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: var(--space-2);
  min-height: clamp(13rem, 22vw, 18rem);
  width: min(100%, 42rem);
  margin-inline: auto;
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.friends-empty-state--compact {
  min-height: 9rem;
  padding-block: var(--space-4);
}

.friends-empty-state h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(1.25rem, 2vw, 1.65rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.friends-empty-state p:not(.eyebrow) {
  max-width: 34rem;
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-base);
  line-height: 1.6;
}

.friends-empty-state .button {
  margin-top: var(--space-2);
}

.form-error {
  margin: 0;
  padding: 0.75rem 1rem;
  border: 1px solid color-mix(in srgb, var(--danger) 48%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--text-primary);
  font-size: var(--font-size-small);
}

.stagger-in > * {
  opacity: 0;
  transform: translateY(var(--space-3));
  animation: friendsFadeInUp 0.4s ease both;
}

.stagger-in > *:nth-child(1) { animation-delay: 0ms; }
.stagger-in > *:nth-child(2) { animation-delay: 80ms; }
.stagger-in > *:nth-child(3) { animation-delay: 160ms; }
.stagger-in > *:nth-child(4) { animation-delay: 240ms; }
.stagger-in > *:nth-child(n + 5) { animation-delay: 320ms; }

@keyframes friendsFadeInUp {
  from {
    opacity: 0;
    transform: translateY(var(--space-3));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1080px) {
  .friend-grid,
  .request-grid,
  .discover-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .friends-page[data-friends-layout='mobile'] {
    gap: var(--space-5);
  }

  .friends-search {
    min-height: 3.25rem;
  }

  .online-rail {
    grid-template-columns: 1fr;
    padding: var(--space-4);
  }

  .online-rail__header {
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stagger-in > * {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
