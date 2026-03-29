<template>
  <article class="user-card surface-card" :class="compact ? 'compact' : 'expanded'">
    <div class="header-row">
      <div class="identity">
        <Avatar :name="user.displayName" :src="user.avatarUrl" :size="compact ? 52 : 60" />
        <div class="identity-copy">
          <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
          <h3>{{ user.displayName }}</h3>
          <p class="meta">{{ metaText }}</p>
        </div>
      </div>
      <span v-if="presence" class="presence-pill" :class="presence">
        <span class="presence-dot" />
        {{ presenceLabel }}
      </span>
    </div>

    <p class="detail">{{ detailText }}</p>

    <div v-if="tagList.length" class="tag-list">
      <span v-for="tag in tagList" :key="tag">{{ tag }}</span>
    </div>

    <div v-if="showStats" class="stat-list">
      <div>
        <strong>{{ user.stats?.spots ?? 0 }}</strong>
        <span>Spots</span>
      </div>
      <div>
        <strong>{{ user.stats?.trips ?? 0 }}</strong>
        <span>Trips</span>
      </div>
      <div>
        <strong>{{ user.stats?.friends ?? 0 }}</strong>
        <span>Friends</span>
      </div>
    </div>

    <div v-if="primaryActionLabel || secondaryActionLabel" class="actions">
      <button v-if="secondaryActionLabel" class="secondary-button" type="button" @click="$emit('secondary-action', user.id)">
        {{ secondaryActionLabel }}
      </button>
      <button v-if="primaryActionLabel" class="primary-button" type="button" @click="$emit('primary-action', user.id)">
        {{ primaryActionLabel }}
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/common/Avatar.vue';
import type { FriendPresence, UserProfile } from '@/types';

const props = withDefaults(
  defineProps<{
    user: UserProfile;
    presence?: FriendPresence;
    eyebrow?: string;
    meta?: string;
    detail?: string;
    tags?: string[];
    compact?: boolean;
    showStats?: boolean;
    primaryActionLabel?: string;
    secondaryActionLabel?: string;
  }>(),
  {
    presence: undefined,
    eyebrow: undefined,
    meta: undefined,
    detail: undefined,
    tags: () => [],
    compact: false,
    showStats: true,
    primaryActionLabel: undefined,
    secondaryActionLabel: undefined,
  },
);

defineEmits<{
  (event: 'primary-action', userId: string): void;
  (event: 'secondary-action', userId: string): void;
}>();

const presenceLabel = computed(() => {
  switch (props.presence) {
    case 'online':
      return 'Online';
    case 'planning':
      return 'Planning';
    case 'offline':
      return 'Offline';
    default:
      return '';
  }
});

const metaText = computed(() => props.meta ?? props.user.homeBase ?? `@${props.user.username}`);
const detailText = computed(() => props.detail ?? props.user.bio ?? 'Building a stronger Atlas adventure graph.');
const tagList = computed(() => props.tags.filter(Boolean));
</script>

<style scoped>
.user-card {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
}

.header-row,
.identity,
.actions,
.tag-list {
  display: flex;
  gap: var(--space-3);
}

.header-row {
  justify-content: space-between;
  align-items: flex-start;
}

.identity {
  align-items: center;
}

.identity-copy {
  display: grid;
  gap: var(--space-1);
}

.eyebrow {
  margin: 0;
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h3,
.meta,
.detail {
  margin: 0;
}

.meta,
.detail,
.stat-list span {
  color: var(--text-secondary);
}

.detail {
  line-height: var(--line-height-relaxed);
}

.presence-pill,
.tag-list span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.45rem 0.8rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  font-size: var(--font-size-small);
}

.presence-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: var(--radius-full);
  background: currentColor;
}

.online {
  color: var(--success);
}

.planning {
  color: var(--accent-gold);
}

.offline {
  color: var(--text-muted);
}

.tag-list {
  flex-wrap: wrap;
}

.stat-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.stat-list div {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  padding: var(--space-3);
}

.stat-list strong {
  display: block;
  margin-bottom: var(--space-1);
  font-size: var(--font-size-h3);
}

.actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.actions button {
  border-radius: var(--radius-full);
  padding: 0.8rem 1rem;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.primary-button {
  border: 1px solid transparent;
  background: var(--accent-teal);
  color: var(--bg-primary);
}

.primary-button:hover,
.primary-button:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-glow-teal);
  transform: translateY(-0.0625rem);
  outline: none;
}

.secondary-button {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
}

.secondary-button:hover,
.secondary-button:focus-visible {
  border-color: var(--border-hover);
  background: var(--bg-primary);
  outline: none;
}

.compact .stat-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 720px) {
  .header-row,
  .actions {
    flex-direction: column;
  }

  .actions button {
    width: 100%;
  }
}
</style>
