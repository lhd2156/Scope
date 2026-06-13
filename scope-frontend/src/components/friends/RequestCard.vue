<template>
  <article
    class="request-card"
    role="button"
    tabindex="0"
    data-test="request-card"
    @click="emit('open', request.user.id)"
    @keydown.enter.prevent="emit('open', request.user.id)"
    @keydown.space.prevent="emit('open', request.user.id)"
  >
    <div class="request-card__body">
      <div class="request-card__header">
        <Avatar :name="request.user.displayName" :src="request.user.avatarUrl" :size="72" class="request-card__avatar" />

        <div class="request-card__identity">
          <h3>{{ request.user.displayName }}</h3>
          <p class="request-card__username">@{{ request.user.username }}</p>
          <p class="request-card__meta">
            <ScopeIcon name="pin" />
            <span>{{ locationLabel }}</span>
          </p>
        </div>

        <span class="request-card__badge">Incoming request</span>
      </div>

      <p class="request-card__note">{{ noteCopy }}</p>

      <div class="request-card__summary">
        <span>{{ pluralizedMutuals }}</span>
        <span>{{ formattedDate }}</span>
      </div>

      <div v-if="categories.length" class="request-card__tags">
        <span
          v-for="category in categories.slice(0, 2)"
          :key="`${request.id}-${category}`"
          class="category-pill"
          :class="`badge-${category}`"
        >
          {{ formatCategoryLabel(category) }}
        </span>
      </div>

      <div class="request-card__actions">
        <button
          :data-test="`decline-request-${request.id}`"
          type="button"
          class="button button-secondary"
          :disabled="saving"
          @click.stop="emit('decline', request.id)"
        >
          Decline
        </button>
        <button
          :data-test="`accept-request-${request.id}`"
          type="button"
          class="button button-primary"
          :disabled="saving"
          @click.stop="emit('accept', request.id)"
        >
          Accept
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/common/Avatar.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import type { FriendRequest, SpotCategory } from '@/types';
import { formatCategoryLabel, formatMonthDay } from '@/utils/formatters';

const props = defineProps<{
  request: FriendRequest;
  categories: SpotCategory[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  (event: 'open', userId: string): void;
  (event: 'accept', requestId: string): void;
  (event: 'decline', requestId: string): void;
}>();

const locationLabel = computed(() => props.request.user.homeBase || 'Scope traveler');
const noteCopy = computed(() => props.request.note || 'Ready to plan a route together.');
const pluralizedMutuals = computed(() => {
  const count = props.request.mutualFriends;
  return `${count} mutual friend${count === 1 ? '' : 's'}`;
});
const formattedDate = computed(() => formatMonthDay(props.request.createdAt));
</script>

<style scoped>
.request-card {
  display: grid;
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--accent-gold) 14%, var(--glass-border));
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-gold) 8%, transparent), transparent 38%),
    linear-gradient(180deg, var(--bg-secondary), color-mix(in srgb, var(--bg-secondary) 96%, var(--bg-primary)));
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.request-card:hover,
.request-card:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: color-mix(in srgb, var(--accent-gold) 36%, var(--border-hover));
}

.request-card:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent-teal) 74%, transparent);
  outline-offset: 3px;
}

.request-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: end;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-gold) 90%, transparent);
  color: var(--bg-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.request-card__body {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
}

.request-card__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-4);
}

.request-card__avatar {
  border-radius: var(--radius-full);
  border: 3px solid var(--bg-secondary);
  background: var(--bg-secondary);
  box-shadow: var(--shadow-md);
}

.request-card__identity {
  display: grid;
  gap: var(--space-1);
}

.request-card__identity h3 {
  margin: 0;
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.request-card__username,
.request-card__meta,
.request-card__note,
.request-card__summary {
  margin: 0;
  color: var(--text-secondary);
}

.request-card__username {
  font-size: var(--font-size-small);
}

.request-card__meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-small);
}

.request-card__meta :deep(.scope-icon) {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--accent-teal);
}

.request-card__note {
  color: var(--text-primary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-relaxed);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.request-card__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  font-size: var(--font-size-caption);
}

.request-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.category-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 70%, transparent);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.04em;
}

.request-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-1);
}

.request-card__actions .button {
  width: 100%;
}

@media (max-width: 480px) {
  .request-card__header {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .request-card__badge {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .request-card__actions {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .request-card {
    transition-duration: 1ms;
  }

  .request-card:hover,
  .request-card:focus-within {
    transform: none;
  }
}
</style>
