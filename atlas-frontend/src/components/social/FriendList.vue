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
            <strong>{{ toFriend(item).displayName }}</strong>
            <p>{{ toFriend(item).homeBase || 'Atlas traveler' }}</p>
          </div>
          <span class="presence-pill" :class="`presence-${toFriend(item).presence || 'offline'}`">
            {{ formatPresence(toFriend(item).presence) }}
          </span>
        </button>
      </template>
    </VirtualList>
  </section>
</template>

<script setup lang="ts">
import Avatar from '@/components/common/Avatar.vue';
import VirtualList from '@/components/common/VirtualList.vue';

interface FriendConnectionCard {
  id: string;
  displayName: string;
  avatarUrl?: string;
  homeBase?: string;
  presence?: string;
}

withDefaults(
  defineProps<{
    friends: FriendConnectionCard[];
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
  grid-template-columns: auto minmax(0, 1fr) auto;
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

.friend-copy {
  min-width: 0;
}

.friend-copy strong,
.friend-copy p {
  margin: 0;
}

.friend-copy p {
  color: var(--text-secondary);
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
  .friend-list__header {
    flex-direction: column;
  }

  .friend-row {
    grid-template-columns: auto 1fr;
  }

  .presence-pill {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
</style>
