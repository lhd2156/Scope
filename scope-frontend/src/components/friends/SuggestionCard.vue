<template>
  <article
    class="suggestion-card suggestion-card--clickable"
    :class="[variant === 'discover' ? 'suggestion-card--discover' : 'suggestion-card--inline']"
    role="button"
    tabindex="0"
    :data-test="testId"
    @click="emit('open', user.id)"
    @keydown.enter.prevent="emit('open', user.id)"
    @keydown.space.prevent="emit('open', user.id)"
  >
    <div class="suggestion-card__identity">
      <Avatar :name="user.displayName" :src="user.avatarUrl" :size="56" class="suggestion-card__avatar" />

      <div class="suggestion-card__copy">
        <strong>{{ user.displayName }}</strong>
        <p>@{{ user.username }}</p>
        <p class="suggestion-card__location">
          <ScopeIcon name="pin" />
          <span>{{ locationLabel }}</span>
        </p>
      </div>
    </div>

    <p class="suggestion-card__reason">{{ reason }}</p>

    <div v-if="variant === 'discover'" class="suggestion-card__meta-row">
      <span>{{ pluralizedMutuals }}</span>
      <span>{{ vibeLabel }}</span>
    </div>

    <div v-if="categories.length" class="suggestion-card__tags">
      <span
        v-for="category in categories.slice(0, 2)"
        :key="`${user.id}-${category}`"
        class="category-pill"
        :class="`badge-${category}`"
      >
          {{ formatCategoryLabel(category) }}
      </span>
    </div>

    <div class="suggestion-card__footer">
      <button
        :data-test="viewTestId"
        type="button"
        class="button button-secondary suggestion-card__action"
        @click.stop="emit('open', user.id)"
      >
        View profile
      </button>
      <button
        :data-test="sendTestId"
        type="button"
        class="button button-primary suggestion-card__action"
        :disabled="actionDisabled"
        @click.stop="emit('send', user)"
      >
        {{ actionLabel }}
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/common/Avatar.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import type { SpotCategory, UserProfile } from '@/types';
import { formatCategoryLabel } from '@/utils/formatters';

const props = withDefaults(
  defineProps<{
    user: UserProfile;
    reason: string;
    categories: SpotCategory[];
    mutualFriends?: number;
    sharedInterests?: string[];
    actionDisabled?: boolean;
    actionLabel: string;
    viewTestId: string;
    sendTestId: string;
    variant?: 'discover' | 'inline';
    testId?: string;
  }>(),
  {
    mutualFriends: 0,
    sharedInterests: () => [],
    actionDisabled: false,
    variant: 'inline',
    testId: 'suggestion-card',
  },
);

const emit = defineEmits<{
  (event: 'open', userId: string): void;
  (event: 'send', user: UserProfile): void;
}>();

const locationLabel = computed(() => props.user.homeBase || 'Scope traveler');

const pluralizedMutuals = computed(() => {
  const count = props.mutualFriends ?? 0;
  return `${count} mutual friend${count === 1 ? '' : 's'}`;
});

const vibeLabel = computed(() => {
  if (props.sharedInterests.length) {
    return props.sharedInterests.slice(0, 2).join(' + ');
  }
  return 'Fresh vibe match';
});

</script>

<style scoped>
.suggestion-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 12%, var(--glass-border));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 8%, transparent), transparent 42%),
    linear-gradient(180deg, var(--bg-secondary), color-mix(in srgb, var(--bg-secondary) 96%, var(--bg-primary)));
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.suggestion-card--discover {
  align-content: start;
}

.suggestion-card:hover,
.suggestion-card:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--border-hover));
}

.suggestion-card:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent-teal) 74%, transparent);
  outline-offset: 3px;
}

.suggestion-card__identity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
}

.suggestion-card__avatar {
  border-radius: var(--radius-full);
  border: 2px solid color-mix(in srgb, var(--bg-secondary) 70%, var(--glass-border));
}

.suggestion-card__copy {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.suggestion-card__copy strong {
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
  letter-spacing: -0.01em;
}

.suggestion-card__copy p {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.suggestion-card__location {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.suggestion-card__location :deep(.scope-icon) {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--accent-teal);
}

.suggestion-card__reason {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-relaxed);
}

.suggestion-card__meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
}

.suggestion-card__meta-row span:first-child {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.suggestion-card__tags {
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

.suggestion-card__footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.suggestion-card__action {
  flex: 1;
  min-width: 7rem;
}

.suggestion-card__action[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .suggestion-card {
    transition-duration: 1ms;
  }

  .suggestion-card:hover,
  .suggestion-card:focus-within {
    transform: none;
  }
}
</style>
