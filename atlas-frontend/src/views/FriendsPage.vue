<template>
  <AppShell>
    <div class="page-container friends-page">
      <section class="glass-panel hero-panel">
        <div>
          <p class="eyebrow">Community</p>
          <h1>{{ authStore.currentUser?.displayName || 'Atlas community' }}</h1>
          <p class="section-copy">Coordinate your travel circle, review incoming requests, and monitor social proof from one workspace.</p>
        </div>

        <div class="hero-metrics">
          <article class="surface-card metric-card">
            <strong>{{ friendConnections.length }}</strong>
            <span>Friends</span>
          </article>
          <article class="surface-card metric-card">
            <strong>{{ onlineFriends }}</strong>
            <span>Online now</span>
          </article>
          <article class="surface-card metric-card">
            <strong>{{ notificationsStore.unreadCount }}</strong>
            <span>Unread</span>
          </article>
        </div>
      </section>

      <article v-if="workspaceError" class="glass-panel error-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Part of the social workspace is offline</h2>
        <p class="section-copy">{{ workspaceError }}</p>
      </article>

      <section v-if="incomingRequests.length" class="section-stack">
        <SectionHeading
          eyebrow="Requests"
          title="Pending friend requests"
          description="Handle incoming invites without leaving the social workspace."
        />

        <VirtualList
          :items="incomingRequests"
          :item-height="232"
          :viewport-height="420"
          list-label="Incoming friend requests"
          :item-key="requestKey"
        >
          <template #default="{ item }">
            <div class="request-row">
              <UserCard
                :user="resolveRequestUserFromUnknown(item)"
                eyebrow="Incoming request"
                primary-action-label="Accept"
                secondary-action-label="Ignore"
              />
            </div>
          </template>
        </VirtualList>
      </section>

      <section class="layout-grid">
        <div class="section-stack">
          <FriendList :friends="friendConnections" @view-profile="openProfile" />
        </div>

        <div class="section-stack">
          <SectionHeading
            eyebrow="Notifications"
            title="Realtime updates"
            description="Keep up with invites, comments, and itinerary changes as they happen."
          />
          <NotificationDropdown />
        </div>
      </section>

      <section class="section-stack">
        <SectionHeading
          eyebrow="Network activity"
          title="Recent Atlas activity"
          description="The freshest stories and moves from your travel network."
        />

        <VirtualList
          v-if="feedStore.items.length"
          :items="feedStore.items"
          :item-height="232"
          :viewport-height="560"
          list-label="Friends activity feed"
        >
          <template #default="{ item }">
            <div class="feed-row">
              <FeedItem :item="item" />
            </div>
          </template>
        </VirtualList>
        <div v-else class="glass-panel empty-panel">
          <strong>No activity yet</strong>
          <p>Once your network starts posting updates, their latest Atlas moves will appear here.</p>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import VirtualList from '@/components/common/VirtualList.vue';
import FeedItem from '@/components/social/FeedItem.vue';
import FriendList from '@/components/social/FriendList.vue';
import NotificationDropdown from '@/components/social/NotificationDropdown.vue';
import UserCard from '@/components/social/UserCard.vue';
import { mockFriendConnections, mockFriendRequests } from '@/services/mockData';
import { useAuthStore } from '@/stores/auth';
import { useFeedStore } from '@/stores/feed';
import { useNotificationsStore } from '@/stores/notifications';
import type { UserProfile } from '@/types';

const authStore = useAuthStore();
const feedStore = useFeedStore();
const notificationsStore = useNotificationsStore();
const router = useRouter();
const friendConnections = ref([...mockFriendConnections]);
const friendRequests = ref([...mockFriendRequests]);

const onlineFriends = computed(() => friendConnections.value.filter((friend) => friend.presence === 'online').length);
const incomingRequests = computed(() => friendRequests.value);
const workspaceError = computed(() => feedStore.error || notificationsStore.error || '');

function requestKey(request: unknown, index: number): string | number {
  if (typeof request === 'object' && request !== null && 'id' in request) {
    const id = (request as { id?: string | number }).id;
    if (typeof id === 'string' || typeof id === 'number') {
      return id;
    }
  }

  return `request-${index}`;
}

function normalizeUsername(displayName: string): string {
  return displayName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'atlastraveler';
}

function resolveRequestUserFromUnknown(request: unknown): UserProfile {
  if (typeof request === 'object' && request !== null) {
    return resolveRequestUser(request as Record<string, unknown>);
  }

  return {
    id: 'request-atlastraveler',
    username: 'atlastraveler',
    email: '',
    displayName: 'Atlas traveler',
    interests: [],
  };
}

function resolveRequestUser(request: Record<string, unknown>): UserProfile {
  const embeddedUser = [request.requester, request.user, request.profile].find(
    (candidate): candidate is Record<string, unknown> => typeof candidate === 'object' && candidate !== null,
  );

  if (embeddedUser && typeof embeddedUser.id === 'string' && typeof embeddedUser.displayName === 'string') {
    return {
      id: embeddedUser.id,
      username: typeof embeddedUser.username === 'string' ? embeddedUser.username : normalizeUsername(embeddedUser.displayName),
      email: typeof embeddedUser.email === 'string' ? embeddedUser.email : '',
      displayName: embeddedUser.displayName,
      avatarUrl: typeof embeddedUser.avatarUrl === 'string' ? embeddedUser.avatarUrl : undefined,
      homeBase: typeof embeddedUser.homeBase === 'string' ? embeddedUser.homeBase : undefined,
      bio: typeof embeddedUser.bio === 'string' ? embeddedUser.bio : undefined,
      interests: Array.isArray(embeddedUser.interests) ? embeddedUser.interests.filter((interest): interest is string => typeof interest === 'string') : [],
      stats: typeof embeddedUser.stats === 'object' && embeddedUser.stats !== null ? (embeddedUser.stats as UserProfile['stats']) : undefined,
    };
  }

  const displayName = typeof request.displayName === 'string' ? request.displayName : 'Atlas traveler';
  return {
    id: typeof request.id === 'string' ? request.id : `request-${normalizeUsername(displayName)}`,
    username: normalizeUsername(displayName),
    email: '',
    displayName,
    interests: [],
  };
}

function openProfile(friendId: string) {
  void router.push(`/profile/${friendId}`);
}

onMounted(async () => {
  await Promise.allSettled([feedStore.fetchFeed(), notificationsStore.fetchNotifications()]);
});
</script>

<style scoped>
.friends-page,
.section-stack {
  display: grid;
  gap: var(--space-6);
}

.hero-panel,
.error-panel,
.empty-panel {
  padding: var(--space-6);
}

.hero-panel {
  display: grid;
  gap: var(--space-6);
}

.hero-metrics,
.layout-grid {
  display: grid;
  gap: var(--space-4);
}

.hero-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-card {
  padding: var(--space-4);
  display: grid;
  gap: var(--space-2);
}

.metric-card strong,
.metric-card span,
.error-panel h2,
.error-panel p,
.empty-panel strong,
.empty-panel p {
  margin: 0;
}

.metric-card span,
.empty-panel p {
  color: var(--text-secondary);
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.layout-grid {
  grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 0.8fr);
  align-items: start;
}

.request-row,
.feed-row {
  padding-bottom: var(--space-4);
}

@media (max-width: 960px) {
  .hero-metrics,
  .layout-grid {
    grid-template-columns: 1fr;
  }
}
</style>
