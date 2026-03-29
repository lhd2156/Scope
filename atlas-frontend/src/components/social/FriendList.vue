<template>
  <section class="friend-list-panel glass-panel">
    <div class="header-block">
      <div>
        <p class="eyebrow">Social graph</p>
        <h2>{{ title }}</h2>
        <p class="section-copy">{{ description }}</p>
      </div>
      <div class="summary-pills">
        <span>{{ friends.length }} total</span>
        <span>{{ onlineCount }} online</span>
        <span>{{ planningCount }} planning</span>
      </div>
    </div>

    <div class="controls-row">
      <label class="search-field">
        <AtlasIcon name="search" label="Search friends" />
        <input v-model="searchQuery" type="search" :placeholder="searchPlaceholder" />
      </label>
      <div class="filter-pills" role="tablist" aria-label="Presence filter">
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          :class="['filter-pill', { active: activeFilter === filter.value }]"
          @click="activeFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
    </div>

    <div v-if="filteredFriends.length" class="card-grid friends-grid">
      <UserCard
        v-for="friend in filteredFriends"
        :key="friend.id"
        :user="friend.user"
        :presence="friend.presence"
        :meta="`${friend.sharedTrips} shared trips · ${friend.mutualFriends} mutual friends`"
        :detail="friend.nextAdventure ? `Next up: ${friend.nextAdventure}` : undefined"
        :tags="friend.favoriteCategories"
        primary-action-label="View profile"
        secondary-action-label="Plan trip"
        @primary-action="$emit('view-profile', $event)"
        @secondary-action="$emit('plan-trip', $event)"
      />
    </div>

    <div v-else class="empty-state surface-card">
      <h3>No friends match that filter yet.</h3>
      <p class="section-copy">Try a broader search or switch filters to inspect the rest of the network.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import UserCard from '@/components/social/UserCard.vue';
import type { FriendConnection, FriendPresence } from '@/types';

const props = withDefaults(
  defineProps<{
    friends: FriendConnection[];
    title?: string;
    description?: string;
    searchPlaceholder?: string;
  }>(),
  {
    title: 'Friends and collaborators',
    description: 'Search the network, see who is online, and jump straight into the next route-building session.',
    searchPlaceholder: 'Search by name, city, or interest',
  },
);

defineEmits<{
  (event: 'view-profile', userId: string): void;
  (event: 'plan-trip', userId: string): void;
}>();

const searchQuery = ref('');
const activeFilter = ref<'all' | FriendPresence>('all');

const filters = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'planning', label: 'Planning' },
  { value: 'offline', label: 'Offline' },
] as const;

const onlineCount = computed(() => props.friends.filter((friend) => friend.presence === 'online').length);
const planningCount = computed(() => props.friends.filter((friend) => friend.presence === 'planning').length);

const filteredFriends = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return props.friends.filter((friend) => {
    const matchesFilter = activeFilter.value === 'all' || friend.presence === activeFilter.value;
    if (!matchesFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchable = [
      friend.user.displayName,
      friend.user.homeBase,
      friend.user.bio,
      ...friend.favoriteCategories,
      friend.nextAdventure,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchable.includes(query);
  });
});
</script>

<style scoped>
.friend-list-panel {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
}

.header-block,
.controls-row,
.summary-pills,
.filter-pills {
  display: flex;
  gap: var(--space-3);
}

.header-block,
.controls-row {
  justify-content: space-between;
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h2,
.empty-state h3 {
  margin: 0 0 var(--space-2);
}

.summary-pills,
.filter-pills {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.summary-pills span,
.filter-pill {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-secondary);
  padding: 0.45rem 0.8rem;
  font-size: var(--font-size-small);
}

.search-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: min(22rem, 100%);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-full);
  background: var(--input-bg);
  padding: 0.8rem 1rem;
  color: var(--text-secondary);
}

.search-field input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-primary);
}

.search-field input:focus {
  outline: none;
}

.filter-pill {
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.filter-pill.active,
.filter-pill:hover,
.filter-pill:focus-visible {
  border-color: transparent;
  background: var(--accent-teal-light);
  color: var(--accent-teal);
  outline: none;
}

.friends-grid {
  gap: var(--space-5);
}

.empty-state {
  padding: var(--space-6);
}

@media (max-width: 900px) {
  .header-block,
  .controls-row {
    flex-direction: column;
  }

  .search-field {
    width: 100%;
  }
}
</style>
