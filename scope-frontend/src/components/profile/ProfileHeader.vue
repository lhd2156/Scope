<template>
  <header class="profile-header" data-test="profile-header">
    <div class="profile-header__row">
      <div class="avatar-shell" data-test="profile-avatar">
        <div class="avatar-ring" :class="{ 'avatar-ring--placeholder': !avatarSource }">
          <LazyImage
            v-if="avatarSource"
            :src="avatarSource"
            :alt="`${user.displayName} profile photo`"
            class="avatar-image"
          />
          <ScopeIcon v-else class="avatar-silhouette" name="user" label="Default profile picture" />
        </div>
        <span v-if="presenceLabel" class="avatar-presence" :class="`avatar-presence--${presence}`" :aria-label="presenceLabel" />
      </div>

      <div class="identity-block">
        <p v-if="isCurrentUser" class="profile-label">Your scope</p>
        <h1>{{ user.displayName }}</h1>
        <p class="username">@{{ user.username }}</p>
        <p class="location">
          <ScopeIcon name="pin" label="Location" />
          <span>{{ user.homeBase || 'Scope community' }}</span>
          <span v-if="presenceLabel" class="presence-chip" :class="`presence-chip--${presence}`">
            <span class="presence-dot" aria-hidden="true" />
            {{ presenceLabel }}
          </span>
        </p>
      </div>

      <div class="action-row">
        <RouterLink :to="primaryActionTo" class="profile-action profile-action--primary">{{ primaryActionLabel }}</RouterLink>
        <RouterLink
          v-if="secondaryActionLabel && secondaryActionTo"
          :to="secondaryActionTo"
          class="profile-action profile-action--ghost"
        >
          {{ secondaryActionLabel }}
        </RouterLink>
      </div>
    </div>

    <p class="bio-copy">{{ bioCopy }}</p>

    <div v-if="user.interests.length" class="interest-row">
      <span
        v-for="interest in user.interests"
        :key="interest"
        class="interest-chip"
        :class="interestChipClass(interest)"
      >
        <ScopeIcon :name="categoryIcon(interest)" :label="formatInterest(interest)" />
        {{ formatInterest(interest) }}
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import type { FriendPresence, SpotCategory, UserProfile } from '@/types';

const props = withDefaults(
  defineProps<{
    user: UserProfile;
    isCurrentUser?: boolean;
    presence?: FriendPresence;
    primaryActionLabel: string;
    primaryActionTo: RouteLocationRaw;
    secondaryActionLabel?: string;
    secondaryActionTo?: RouteLocationRaw;
  }>(),
  {
    isCurrentUser: false,
    presence: undefined,
    secondaryActionLabel: undefined,
    secondaryActionTo: undefined,
  },
);

const availableCategories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];

const bioCopy = computed(() => props.user.bio?.trim() || 'Building a Scope footprint one memorable pin at a time.');
const avatarSource = computed(() => props.user.avatarUrl?.trim() ?? '');
const presenceLabel = computed(() => {
  switch (props.presence) {
    case 'planning':
      return 'Planning now';
    case 'online':
      return 'Online now';
    case 'idle':
      return 'Idle';
    case 'hidden':
      return 'Activity hidden';
    case 'offline':
      return 'Offline';
    default:
      return '';
  }
});

function toBadgeCategory(value: string): SpotCategory {
  const normalizedValue = value.trim().toLowerCase();
  return availableCategories.find((category) => category === normalizedValue) ?? 'other';
}

function formatInterest(value: string): string {
  const normalizedValue = value.trim();
  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1);
}

function categoryIcon(value: string): string {
  const category = toBadgeCategory(value);
  return category === 'other' ? 'sparkle' : category;
}

function interestChipClass(value: string): string {
  return `badge-${toBadgeCategory(value)}`;
}
</script>

<style scoped>
.profile-header {
  container-type: inline-size;
  display: grid;
  gap: var(--space-5);
  padding: clamp(var(--space-5), 3vw, var(--space-6));
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 96%, transparent);
}

.profile-header__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(var(--space-4), 2vw, var(--space-5));
}

.avatar-shell {
  position: relative;
  width: 5.5rem;
  height: 5.5rem;
  flex-shrink: 0;
}

.avatar-ring {
  width: 100%;
  height: 100%;
  padding: 2px;
  border-radius: var(--radius-full);
  border: 2px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: var(--bg-primary);
}

.avatar-image,
.avatar-silhouette {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
}

.avatar-image {
  display: block;
  object-fit: cover;
  background: var(--bg-tertiary);
}

.avatar-silhouette {
  display: block;
  padding: 22%;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.avatar-ring--placeholder {
  background: var(--bg-tertiary);
}

.avatar-presence {
  position: absolute;
  right: 0.15rem;
  bottom: 0.15rem;
  width: 1rem;
  height: 1rem;
  border-radius: var(--radius-full);
  border: 2px solid var(--bg-secondary);
  background: var(--text-muted);
}

.avatar-presence--online { background: var(--success); }
.avatar-presence--planning { background: var(--accent-gold); }
.avatar-presence--idle { background: var(--warning); }
.avatar-presence--hidden,
.avatar-presence--offline { background: var(--text-muted); }

.identity-block {
  display: grid;
  gap: 0.32rem;
  min-width: 0;
}

.profile-label {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: var(--font-weight-semibold);
}

h1,
.username,
.location,
.bio-copy,
p,
span {
  margin: 0;
}

h1 {
  font-size: clamp(var(--font-size-h1), 4vw, 3rem);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.username {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.location {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  margin-top: 0.2rem;
}

.location :deep(.scope-icon) {
  width: 0.85rem;
  height: 0.85rem;
  color: var(--accent-teal);
}

.presence-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 60%, transparent);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.presence-chip--online { color: var(--success); }
.presence-chip--planning { color: var(--accent-gold); }
.presence-chip--idle { color: var(--warning); }
.presence-chip--hidden,
.presence-chip--offline { color: var(--text-secondary); }

.presence-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: var(--radius-full);
  background: currentColor;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.profile-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 2.35rem;
  padding: 0 1rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.profile-action--primary {
  background: var(--accent-teal);
  color: var(--bg-primary);
  border: 1px solid var(--accent-teal);
}

.profile-action--primary:hover,
.profile-action--primary:focus-visible {
  background: var(--accent-teal-hover);
  border-color: var(--accent-teal-hover);
}

.profile-action--ghost {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
}

.profile-action--ghost:hover,
.profile-action--ghost:focus-visible {
  background: color-mix(in srgb, var(--bg-tertiary) 70%, transparent);
  border-color: color-mix(in srgb, var(--glass-border) 100%, transparent);
}

.bio-copy {
  margin-top: 0.1rem;
  max-width: 42rem;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: 1.5;
}

.interest-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.interest-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.interest-chip :deep(.scope-icon) {
  width: 0.85rem;
  height: 0.85rem;
}

@container (max-width: 44rem) {
  .profile-header__row {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'avatar identity'
      'actions actions';
  }

  .avatar-shell {
    grid-area: avatar;
  }

  .identity-block {
    grid-area: identity;
  }

  .action-row {
    grid-area: actions;
    justify-content: stretch;
  }

  .profile-action {
    flex: 1;
  }
}

@media (max-width: 720px) {
  .profile-header__row {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'avatar identity'
      'actions actions';
  }

  .avatar-shell {
    grid-area: avatar;
  }

  .identity-block {
    grid-area: identity;
  }

  .action-row {
    grid-area: actions;
    justify-content: stretch;
  }

  .profile-action {
    flex: 1;
  }
}
</style>
