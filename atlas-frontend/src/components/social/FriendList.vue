<template>
  <section class="friend-list glass-panel">
    <header class="friend-list__header">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h2>{{ resolvedTitle }}</h2>
      </div>
      <p class="section-copy">{{ resolvedDescription }}</p>
    </header>

    <div v-if="friends.length" class="friend-grid" role="list" aria-label="Friend connections">
      <article
        v-for="friend in resolvedFriends"
        :key="friend.id"
        class="friend-card"
        data-test="friend-card"
        role="listitem"
      >
        <div class="friend-card__header">
          <div class="friend-card__avatar-shell">
            <Avatar :name="friend.displayName" :src="friend.avatarUrl" :size="56" />
            <span
              class="friend-card__status-dot"
              :class="`friend-card__status-dot--${friend.presence || 'offline'}`"
              :aria-label="`${formatPresence(friend.presence)} status`"
            />
          </div>

          <span class="friend-card__presence-pill" :class="`friend-card__presence-pill--${friend.presence || 'offline'}`">
            {{ formatPresence(friend.presence) }}
          </span>
        </div>

        <div class="friend-card__body">
          <div>
            <h3>{{ friend.displayName }}</h3>
            <p class="friend-card__username">@{{ friend.username || 'atlastraveler' }}</p>
          </div>

          <p class="friend-card__location">
            <AtlasIcon name="pin" />
            <span>{{ friend.homeBase || 'Atlas traveler' }}</span>
          </p>

          <div class="friend-card__stats" aria-label="Friend connection details">
            <span>{{ formatMutualFriends(friend.mutualFriends) }}</span>
            <span>{{ formatSharedTrips(friend.sharedTrips) }}</span>
          </div>

          <p class="friend-card__route">{{ friend.nextAdventure || 'Ready for the next Atlas route.' }}</p>
        </div>

        <button class="friend-card__button" type="button" @click="$emit('view-profile', friend.id)">
          View Profile
        </button>
      </article>
    </div>

    <EmptyStatePanel
      v-else
      tone="surface"
      compact
      :eyebrow="eyebrow"
      title="Your Atlas circle is still forming"
      description="As you accept requests and invite collaborators, your core travel crew will appear here."
      icon="friends"
      artwork="community"
      heading-level="h3"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import Avatar from '@/components/common/Avatar.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import type { FriendConnection, FriendPresence } from '@/types';

interface FriendConnectionCard {
  id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  homeBase?: string;
  presence?: FriendPresence | string;
  sharedTrips?: number;
  mutualFriends?: number;
  nextAdventure?: string;
}

type FriendListItem = FriendConnectionCard | FriendConnection;

const props = withDefaults(
  defineProps<{
    friends: FriendListItem[];
    eyebrow?: string;
    title?: string;
    description?: string;
  }>(),
  {
    eyebrow: 'Connections',
    title: undefined,
    description: undefined,
  },
);

defineEmits<{
  (event: 'view-profile', friendId: string): void;
}>();

const resolvedFriends = computed(() => props.friends.map((friend) => toFriend(friend)));
const resolvedTitle = computed(() => props.title ?? `${props.friends.length} friend${props.friends.length === 1 ? '' : 's'} on Atlas`);
const resolvedDescription = computed(
  () => props.description ?? 'Keep your core travel circle close and jump into their latest plans fast.',
);

function toFriend(value: unknown): FriendConnectionCard {
  if (typeof value === 'object' && value !== null && 'user' in value) {
    const connection = value as FriendConnection;
    return {
      id: connection.user.id,
      displayName: connection.user.displayName,
      username: connection.user.username,
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

function formatPresence(presence?: string): string {
  if (!presence) {
    return 'Offline';
  }

  return presence.charAt(0).toUpperCase() + presence.slice(1);
}

function formatMutualFriends(mutualFriends?: number): string {
  const count = mutualFriends ?? 0;
  return `${count} mutual friend${count === 1 ? '' : 's'}`;
}

function formatSharedTrips(sharedTrips?: number): string {
  const count = sharedTrips ?? 0;
  return `${count} shared trip${count === 1 ? '' : 's'}`;
}
</script>

<style scoped>
.friend-list {
  display: grid;
  gap: var(--space-5);
  padding: clamp(var(--space-5), 2vw, var(--space-6));
}

.friend-list__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(15rem, 22rem);
  gap: var(--space-4);
  align-items: start;
}

.friend-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.eyebrow,
.friend-list__header h2,
.friend-card h3,
.friend-card__username,
.friend-card__location,
.friend-card__route {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.friend-card {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-2xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 40%),
    radial-gradient(circle at bottom left, color-mix(in srgb, var(--accent-gold) 10%, transparent), transparent 42%),
    color-mix(in srgb, var(--glass-bg) 100%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-md);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.friend-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--text-primary) 6%, transparent) 0%, transparent 40%),
    linear-gradient(320deg, color-mix(in srgb, var(--accent-teal) 10%, transparent), transparent 48%);
  pointer-events: none;
}

.friend-card > * {
  position: relative;
  z-index: 1;
}

.friend-card:hover,
.friend-card:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
}

.friend-card__header,
.friend-card__body {
  display: grid;
  gap: var(--space-3);
}

.friend-card__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
}

.friend-card__avatar-shell {
  position: relative;
  width: fit-content;
  padding: 0.2rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 88%, transparent);
}

.friend-card__avatar-shell :deep(.avatar img) {
  transition: transform var(--transition-slow);
}

.friend-card:hover .friend-card__avatar-shell :deep(.avatar img),
.friend-card:focus-within .friend-card__avatar-shell :deep(.avatar img) {
  transform: scale(1.05);
}

.friend-card__status-dot {
  position: absolute;
  right: 0.2rem;
  bottom: 0.2rem;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: var(--radius-full);
  border: 2px solid color-mix(in srgb, var(--bg-secondary) 100%, transparent);
  box-shadow: var(--shadow-sm);
}

.friend-card__status-dot--online {
  background: var(--success);
}

.friend-card__status-dot--planning {
  background: var(--accent-gold);
}

.friend-card__status-dot--offline {
  background: var(--text-muted);
}

.friend-card__presence-pill,
.friend-card__stats span,
.friend-card__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--glass-bg) 90%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-sm);
  font-size: var(--font-size-small);
}

.friend-card__presence-pill {
  padding: 0.5rem 0.85rem;
  color: var(--text-secondary);
}

.friend-card__presence-pill--online {
  color: var(--success);
}

.friend-card__presence-pill--planning {
  color: var(--accent-gold);
}

.friend-card__body {
  min-width: 0;
}

.friend-card h3 {
  color: var(--text-primary);
  font-size: var(--font-size-h3);
  line-height: 1.25;
}

.friend-card__username,
.friend-card__location,
.friend-card__route {
  color: var(--text-secondary);
}

.friend-card__username {
  font-size: var(--font-size-small);
}

.friend-card__location {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.friend-card__location :deep(.atlas-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-teal);
}

.friend-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.friend-card__stats span {
  padding: 0.45rem 0.8rem;
  color: var(--text-primary);
}

.friend-card__route {
  line-height: var(--line-height-relaxed);
}

.friend-card__button {
  min-height: 2.75rem;
  width: 100%;
  padding: 0.8rem 1rem;
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.friend-card__button:hover,
.friend-card__button:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 46%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--glass-bg));
  box-shadow: var(--shadow-glow-teal);
  outline: none;
}

.friend-card__button:active {
  transform: translateY(0) scale(0.97);
}

@media (max-width: 1180px) {
  .friend-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .friend-list__header {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .friend-grid,
  .friend-card__header {
    grid-template-columns: 1fr;
  }

  .friend-card__presence-pill {
    width: fit-content;
  }
}

@media (prefers-reduced-motion: reduce) {
  .friend-card,
  .friend-card__avatar-shell :deep(.avatar img),
  .friend-card__button {
    transition: none;
  }

  .friend-card:hover,
  .friend-card:focus-within,
  .friend-card:hover .friend-card__avatar-shell :deep(.avatar img),
  .friend-card:focus-within .friend-card__avatar-shell :deep(.avatar img),
  .friend-card__button:hover,
  .friend-card__button:focus-visible,
  .friend-card__button:active {
    transform: none;
  }
}
</style>
