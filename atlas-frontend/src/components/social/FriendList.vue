<template>
  <section class="friend-list glass-panel">
    <header class="friend-list__header">
      <div>
        <p class="eyebrow">Connections</p>
        <h2>{{ friends.length }} friends on Atlas</h2>
      </div>
      <p class="section-copy">Keep your core travel circle close and jump into their latest plans fast.</p>
    </header>

    <VirtualList
      :items="friends"
      :item-height="136"
      :viewport-height="viewportHeight"
      list-label="Friend connections"
      :item-key="friendKey"
    >
      <template #default="{ item }">
        <button class="surface-card friend-row" type="button" @click="$emit('view-profile', toFriend(item).id)">
          <Avatar :name="toFriend(item).displayName" :src="toFriend(item).avatarUrl" :size="52" />
          <div class="friend-copy">
            <div class="friend-copy__header">
              <strong>{{ toFriend(item).displayName }}</strong>
              <span class="presence-pill" :class="`presence-${toFriend(item).presence || 'offline'}`">
                {{ formatPresence(toFriend(item).presence) }}
              </span>
            </div>
            <p>{{ toFriend(item).homeBase || 'Atlas traveler' }}</p>
            <div class="friend-meta">
              <span v-if="typeof toFriend(item).sharedTrips === 'number'">{{ toFriend(item).sharedTrips }} shared trip{{ toFriend(item).sharedTrips === 1 ? '' : 's' }}</span>
              <span v-if="typeof toFriend(item).mutualFriends === 'number'">{{ toFriend(item).mutualFriends }} mutual friend{{ toFriend(item).mutualFriends === 1 ? '' : 's' }}</span>
              <span v-if="toFriend(item).nextAdventure">Next: {{ toFriend(item).nextAdventure }}</span>
            </div>
          </div>
        </button>
      </template>
    </VirtualList>
  </section>
</template>

<script setup lang="ts">
import Avatar from '@/components/common/Avatar.vue';
import VirtualList from '@/components/common/VirtualList.vue';
import type { FriendConnection, FriendPresence } from '@/types';

interface FriendConnectionCard {
  id: string;
  displayName: string;
  avatarUrl?: string;
  homeBase?: string;
  presence?: FriendPresence | string;
  sharedTrips?: number;
  mutualFriends?: number;
  nextAdventure?: string;
}

type FriendListItem = FriendConnectionCard | FriendConnection;

withDefaults(
  defineProps<{
    friends: FriendListItem[];
    viewportHeight?: number;
  }>(),
  {
    viewportHeight: 420,
  },
);

defineEmits<{
  (event: 'view-profile', friendId: string): void;
}>();

function toFriend(value: unknown): FriendConnectionCard {
  if (typeof value === 'object' && value !== null && 'user' in value) {
    const connection = value as FriendConnection;
    return {
      id: connection.user.id,
      displayName: connection.user.displayName,
      avatarUrl: connection.user.avatarUrl,
      homeBase: connection.user.homeBase,
      presence: connection.presence,
      sharedTrips: connection.sharedTrips,
      mutualFriends: connection.mutualFriends,
      nextAdventure: connection.nextAdventure,
    };
  }

  return value as FriendConnectionCard;
}

function friendKey(friend: unknown, index: number): string | number {
  return toFriend(friend).id || `friend-${index}`;
}

function formatPresence(presence?: string): string {
  if (!presence) {
    return 'Offline';
  }

  return presence.charAt(0).toUpperCase() + presence.slice(1);
}
</script>

<style scoped>
.friend-list {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
}

.friend-list__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.friend-list__header h2,
.friend-list__header p {
  margin: 0;
}

.friend-row {
  width: 100%;
  height: calc(136px - 0.5rem);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 0;
  background: var(--bg-secondary);
  cursor: pointer;
  text-align: left;
}

.friend-row:hover,
.friend-row:focus-visible {
  outline: none;
  border-color: var(--border-hover);
  box-shadow: var(--shadow-glow-teal);
}

.friend-copy,
.friend-copy__header,
.friend-meta {
  display: grid;
  gap: var(--space-2);
}

.friend-copy {
  min-width: 0;
}

.friend-copy__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.friend-copy strong,
.friend-copy p,
.friend-meta span {
  margin: 0;
}

.friend-copy p,
.friend-meta span {
  color: var(--text-secondary);
}

.friend-meta {
  grid-template-columns: repeat(3, minmax(0, max-content));
  gap: var(--space-2) var(--space-3);
  font-size: var(--font-size-small);
}

.presence-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-small);
  background: var(--bg-primary);
  color: var(--text-secondary);
}

.presence-online,
.presence-planning {
  color: var(--accent-teal);
}

@media (max-width: 720px) {
  .friend-list__header,
  .friend-copy__header {
    flex-direction: column;
    grid-template-columns: 1fr;
    align-items: flex-start;
  }

  .friend-meta {
    grid-template-columns: 1fr;
  }
}
</style>
