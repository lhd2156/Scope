<template>
  <AppShell>
    <div class="page-container page-stack friends-page">
      <SectionHeading
        eyebrow="Friends"
        title="Keep the social layer close to the route planner"
        description="Track collaborators, process friend requests, and keep tabs on the notifications that matter before the next trip locks in."
      />

      <section class="hero-grid">
        <article class="glass-panel hero-card">
          <p class="eyebrow">Network summary</p>
          <h2>{{ authStore.currentUser?.displayName ?? 'Atlas network' }}</h2>
          <p class="section-copy">
            Your social workspace blends accepted friends, pending requests, live alerts, and the feed stream that fuels itinerary planning.
          </p>
        </article>

        <article class="summary-card surface-card">
          <strong>{{ onlineFriends }}</strong>
          <span>Online collaborators</span>
        </article>
        <article class="summary-card surface-card">
          <strong>{{ incomingRequests.length }}</strong>
          <span>Incoming requests</span>
        </article>
        <article class="summary-card surface-card">
          <strong>{{ notificationsStore.unreadCount }}</strong>
          <span>Unread alerts</span>
        </article>
      </section>

      <section v-if="friendRequests.length" class="request-grid">
        <SectionHeading
          eyebrow="Requests"
          title="Pending connection requests"
          description="Accept new collaborators or keep outgoing requests visible while the network grows."
        />
        <div class="card-grid request-cards">
          <UserCard
            v-for="request in friendRequests"
            :key="request.id"
            :user="request.user"
            :eyebrow="request.direction === 'incoming' ? 'Incoming request' : 'Outgoing request'"
            :meta="`${request.mutualFriends} mutual friends · ${formatRelativeTime(request.createdAt)}`"
            :detail="request.note"
            :tags="request.user.interests"
            :show-stats="false"
            :primary-action-label="request.direction === 'incoming' ? 'Accept' : 'View profile'"
            :secondary-action-label="request.direction === 'incoming' ? 'Decline' : 'Cancel request'"
            @primary-action="handlePrimaryRequestAction(request.id, request.direction, request.user.id)"
            @secondary-action="handleSecondaryRequestAction(request.id, request.direction)"
          />
        </div>
      </section>

      <section class="workspace-grid">
        <div class="main-column">
          <FriendList :friends="friendConnections" @view-profile="openProfile" @plan-trip="openTripPlanner" />

          <article class="glass-panel feed-panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Activity feed</p>
                <h2>Fresh moments from the network</h2>
              </div>
              <span class="meta-copy">{{ feedStore.items.length }} stories loaded</span>
            </div>
            <p v-if="feedStore.loading" class="section-copy">Loading activity...</p>
            <div v-else class="feed-list">
              <FeedItem v-for="item in feedStore.items" :key="item.id" :item="item" />
            </div>
          </article>
        </div>

        <aside class="side-column">
          <NotificationDropdown
            inline-panel
            :notifications="notificationsStore.items"
            :unread-count="notificationsStore.unreadCount"
            :loading="notificationsStore.loading"
            :connection-state="notificationsStore.connectionState"
            :connection-error="notificationsStore.connectionError"
            @mark-all-read="notificationsStore.markAllRead"
            @read="notificationsStore.markRead"
          />
        </aside>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import FeedItem from '@/components/social/FeedItem.vue';
import FriendList from '@/components/social/FriendList.vue';
import NotificationDropdown from '@/components/social/NotificationDropdown.vue';
import UserCard from '@/components/social/UserCard.vue';
import { mockFriendConnections, mockFriendRequests } from '@/services/socialMockData';
import { useAuthStore } from '@/stores/auth';
import { useFeedStore } from '@/stores/feed';
import { useNotificationsStore } from '@/stores/notifications';
import type { FriendRequest, SpotCategory } from '@/types';
import { formatRelativeTime } from '@/utils/formatters';

const authStore = useAuthStore();
const feedStore = useFeedStore();
const notificationsStore = useNotificationsStore();
const router = useRouter();

const friendConnections = ref([...mockFriendConnections]);
const friendRequests = ref<FriendRequest[]>([...mockFriendRequests]);

const onlineFriends = computed(() => friendConnections.value.filter((friend) => friend.presence === 'online').length);
const incomingRequests = computed(() => friendRequests.value.filter((request) => request.direction === 'incoming'));

function openProfile(userId: string) {
  void router.push(`/profile/${userId}`);
}

function openTripPlanner(userId: string) {
  void router.push({ path: '/trips/new', query: { friend: userId } });
}

function handlePrimaryRequestAction(requestId: string, direction: FriendRequest['direction'], userId: string) {
  if (direction === 'incoming') {
    const request = friendRequests.value.find((entry) => entry.id === requestId);
    if (request) {
      friendConnections.value = [
        {
          id: `friend-${request.user.id}`,
          user: request.user,
          presence: 'planning',
          sharedTrips: 0,
          mutualFriends: request.mutualFriends,
          favoriteCategories: request.user.interests.slice(0, 3) as SpotCategory[],
          nextAdventure: 'First route planning session pending',
          lastActiveAt: new Date().toISOString(),
        },
        ...friendConnections.value,
      ];
    }

    friendRequests.value = friendRequests.value.filter((entry) => entry.id !== requestId);
    return;
  }

  openProfile(userId);
}

function handleSecondaryRequestAction(requestId: string, _direction: FriendRequest['direction']) {
  friendRequests.value = friendRequests.value.filter((entry) => entry.id !== requestId);
}

onMounted(async () => {
  await Promise.all([feedStore.fetchFeed(), notificationsStore.fetchNotifications()]);
});
</script>

<style scoped>
.friends-page {
  display: grid;
  gap: var(--space-6);
}

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) repeat(3, minmax(0, 0.45fr));
  gap: var(--space-4);
}

.hero-card,
.summary-card,
.feed-panel {
  padding: var(--space-6);
}

.summary-card {
  display: grid;
  gap: var(--space-2);
  align-content: start;
}

.summary-card strong {
  font-size: var(--font-size-h1);
}

.summary-card span,
.meta-copy {
  color: var(--text-secondary);
}

.request-grid {
  display: grid;
  gap: var(--space-4);
}

.request-cards {
  gap: var(--space-4);
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(18rem, 0.95fr);
  gap: var(--space-6);
  align-items: start;
}

.main-column {
  display: grid;
  gap: var(--space-6);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.feed-list {
  display: grid;
  gap: var(--space-4);
}

@media (max-width: 1200px) {
  .hero-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-card {
    grid-column: 1 / -1;
  }
}

@media (max-width: 1024px) {
  .workspace-grid,
  .hero-grid {
    grid-template-columns: 1fr;
  }

  .panel-header {
    flex-direction: column;
  }
}
</style>
