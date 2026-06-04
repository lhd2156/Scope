<template>
  <article
    class="friend-card friend-card--clickable"
    :class="`is-${connection.presence}`"
    role="button"
    tabindex="0"
    data-test="friend-card"
    @click="emit('open', connection.user.id)"
    @keydown.enter.prevent="emit('open', connection.user.id)"
    @keydown.space.prevent="emit('open', connection.user.id)"
  >
    <div class="friend-card__profile-stage">
      <p class="friend-card__presence-chip" :class="`is-${connection.presence}`" data-test="friend-card-status">
        <span aria-hidden="true" />
        {{ presenceChipLabel }}
      </p>
      <span class="friend-card__avatar-ring" :class="`is-${connection.presence}`">
        <Avatar :name="connection.user.displayName" :src="connection.user.avatarUrl" :size="92" class="friend-card__avatar" />
        <span class="friend-card__avatar-dot" :class="`is-${connection.presence}`" :title="presenceDetail" />
      </span>
    </div>

    <div class="friend-card__body">
      <div class="friend-card__identity">
        <h3>{{ connection.user.displayName }}</h3>
        <p class="friend-card__username">@{{ connection.user.username }}</p>
        <p class="friend-card__location">
          <ScopeIcon name="pin" />
          <span>{{ locationLabel }}</span>
        </p>
        <p class="friend-card__adventure">{{ adventureCopy }}</p>
      </div>

      <button
        :data-test="`view-profile-${connection.user.id}`"
        type="button"
        class="friend-card__action"
        @click.stop="emit('open', connection.user.id)"
      >
        View
      </button>
      <button
        :data-test="`remove-friend-${connection.id}`"
        type="button"
        class="friend-card__action friend-card__action--danger"
        @click.stop="emit('remove', connection.id)"
      >
        Remove
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/common/Avatar.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import type { FriendConnection, UserProfile } from '@/types';
import { formatMonthDay } from '@/utils/formatters';

const props = defineProps<{
  connection: FriendConnection;
}>();

const emit = defineEmits<{
  (event: 'open', userId: string): void;
  (event: 'remove', connectionId: string): void;
}>();

const locationLabel = computed<string>(() => userLocation(props.connection.user));
const presenceChipLabel = computed<string>(() => {
  switch (props.connection.presence) {
    case 'planning':
      return 'Planning a trip';
    case 'online':
      return 'Online now';
    case 'idle':
      return 'Idle';
    case 'hidden':
      return 'Activity hidden';
    default:
      return props.connection.lastActiveAt
        ? `Active ${formatMonthDay(props.connection.lastActiveAt)}`
        : 'Offline';
  }
});

const presenceDetail = computed<string>(() => {
  switch (props.connection.presence) {
    case 'planning':
      return 'Planning a trip right now';
    case 'online':
      return 'Online now';
    case 'idle':
      return 'Idle for a few minutes';
    case 'hidden':
      return 'Activity hidden';
    default:
      return props.connection.lastActiveAt
        ? `Active ${formatMonthDay(props.connection.lastActiveAt)}`
        : 'Offline';
  }
});

const adventureCopy = computed<string>(() => props.connection.nextAdventure || 'Ready for the next itinerary.');

function userLocation(user: UserProfile): string {
  return user.homeBase || 'Scope traveler';
}
</script>

<style scoped>
.friend-card {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 12%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-secondary) 96%, var(--bg-tertiary));
  box-shadow: none;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast);
  content-visibility: auto;
  contain-intrinsic-size: 320px;
}

.friend-card:hover,
.friend-card:focus-within {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--border-hover));
}

.friend-card--clickable:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent-teal) 74%, transparent);
  outline-offset: 2px;
}

.friend-card__profile-stage {
  position: relative;
  display: grid;
  place-items: center;
  min-height: clamp(10rem, 15vw, 11.5rem);
  padding: var(--space-5) var(--space-4) var(--space-4);
  overflow: hidden;
  border-bottom: 1px solid color-mix(in srgb, var(--glass-border) 56%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 76%, var(--bg-secondary));
}

.friend-card__profile-stage::after {
  content: none;
}

.friend-card__presence-chip {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  max-width: calc(100% - 1.3rem);
  min-height: 1.75rem;
  margin: 0;
  padding: 0.35rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 84%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 72%, var(--bg-secondary));
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  white-space: nowrap;
}

.friend-card__presence-chip > span {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: var(--radius-full);
  background: var(--text-muted);
}

.friend-card__presence-chip.is-online {
  color: var(--success);
}

.friend-card__presence-chip.is-planning {
  color: var(--accent-gold);
}

.friend-card__presence-chip.is-idle {
  color: var(--warning);
}

.friend-card__presence-chip.is-hidden,
.friend-card__presence-chip.is-offline {
  color: var(--text-secondary);
}

.friend-card__presence-chip.is-online > span { background: var(--success); }
.friend-card__presence-chip.is-planning > span { background: var(--accent-gold); }
.friend-card__presence-chip.is-idle > span { background: var(--warning); }
.friend-card__presence-chip.is-hidden > span,
.friend-card__presence-chip.is-offline > span { background: var(--text-muted); }

.friend-card__body {
  position: relative;
  display: grid;
  justify-items: center;
  gap: var(--space-4);
  min-height: 11rem;
  padding: var(--space-4) var(--space-5) var(--space-5);
  text-align: center;
}

.friend-card__avatar-ring {
  position: relative;
  z-index: 1;
  display: inline-grid;
  place-items: center;
  padding: 5px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--text-secondary) 26%, var(--bg-tertiary));
  box-shadow: none;
}

.friend-card__avatar-ring.is-online {
  background: linear-gradient(135deg, var(--success), var(--accent-teal));
}

.friend-card__avatar-ring.is-planning {
  background: linear-gradient(135deg, var(--accent-gold), var(--accent-teal));
}

.friend-card__avatar-ring.is-idle {
  background: linear-gradient(135deg, var(--warning), color-mix(in srgb, var(--accent-gold) 55%, var(--bg-tertiary)));
}

.friend-card__avatar-ring.is-hidden,
.friend-card__avatar-ring.is-offline {
  background: color-mix(in srgb, var(--text-secondary) 30%, var(--bg-tertiary));
}

.friend-card__avatar {
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  box-shadow: none;
}

.friend-card__avatar-dot {
  position: absolute;
  right: 0.22rem;
  bottom: 0.22rem;
  width: 1.05rem;
  height: 1.05rem;
  border-radius: var(--radius-full);
  border: 2px solid var(--bg-secondary);
  background: var(--text-muted);
}

.friend-card__avatar-dot.is-online { background: var(--success); }
.friend-card__avatar-dot.is-planning { background: var(--accent-gold); }
.friend-card__avatar-dot.is-offline { background: var(--text-muted); }
.friend-card__avatar-dot.is-idle { background: var(--warning); }
.friend-card__avatar-dot.is-hidden { background: var(--text-muted); }

.friend-card__identity {
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  min-width: 0;
  width: 100%;
}

.friend-card__identity h3 {
  margin: 0;
  font-size: 1.12rem;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.friend-card__username {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.86rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.friend-card__location {
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.86rem;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.friend-card__location :deep(.scope-icon) {
  width: 0.8rem;
  height: 0.8rem;
  color: var(--accent-teal);
  flex-shrink: 0;
}

.friend-card__adventure {
  margin: 0;
  color: color-mix(in srgb, var(--text-secondary) 88%, var(--text-primary));
  font-size: 0.84rem;
  line-height: 1.25;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  max-width: 100%;
}

.friend-card__action {
  align-self: center;
  padding: 0.52rem 1.15rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 40%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 12%, transparent);
  color: var(--accent-teal);
  font-size: 0.86rem;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.friend-card__action:hover,
.friend-card__action:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--accent-teal) 22%, transparent);
  border-color: color-mix(in srgb, var(--accent-teal) 60%, var(--glass-border));
  transform: translateY(-1px);
}

.friend-card__action--danger {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--glass-border));
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  color: var(--danger);
}

.friend-card__action--danger:hover,
.friend-card__action--danger:focus-visible {
  background: color-mix(in srgb, var(--danger) 16%, transparent);
  border-color: color-mix(in srgb, var(--danger) 54%, var(--glass-border));
}

@media (prefers-reduced-motion: reduce) {
  .friend-card,
  .friend-card__action {
    transition-duration: 1ms;
  }

  .friend-card:hover,
  .friend-card:focus-within,
  .friend-card__action:hover,
  .friend-card__action:focus-visible {
    transform: none;
  }
}
</style>
