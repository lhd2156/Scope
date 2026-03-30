<template>
  <header class="profile-header glass-panel" data-test="profile-header">
    <div class="profile-halo" aria-hidden="true" />

    <div class="avatar-shell" data-test="profile-avatar">
      <div class="avatar-ring">
        <LazyImage v-if="avatarSource" :src="avatarSource" :alt="`${user.displayName} profile photo`" class="avatar-image" />
        <span v-else class="avatar-fallback">{{ initials }}</span>
      </div>
    </div>

    <div class="header-topline">
      <p class="eyebrow">{{ isCurrentUser ? 'Your atlas' : 'Explorer profile' }}</p>
      <span class="meta-pill">{{ profileSignature }}</span>
    </div>

    <div class="identity-copy">
      <h1>{{ user.displayName }}</h1>
      <p class="username">@{{ user.username }}</p>
      <p class="location">
        <AtlasIcon name="pin" label="Home base" />
        <span>{{ user.homeBase || 'Atlas community' }}</span>
      </p>
      <p class="section-copy">{{ bioCopy }}</p>
    </div>

    <div v-if="user.interests.length" class="interest-row">
      <span
        v-for="interest in user.interests"
        :key="interest"
        class="interest-chip"
        :class="interestChipClass(interest)"
      >
        {{ formatInterest(interest) }}
      </span>
    </div>

    <div class="action-row">
      <RouterLink :to="primaryActionTo" class="button button-primary">{{ primaryActionLabel }}</RouterLink>
      <RouterLink
        v-if="secondaryActionLabel && secondaryActionTo"
        :to="secondaryActionTo"
        class="button button-secondary"
      >
        {{ secondaryActionLabel }}
      </RouterLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import type { SpotCategory, UserProfile } from '@/types';
import { getInitials } from '@/utils/formatters';

const props = withDefaults(
  defineProps<{
    user: UserProfile;
    isCurrentUser?: boolean;
    primaryActionLabel: string;
    primaryActionTo: RouteLocationRaw;
    secondaryActionLabel?: string;
    secondaryActionTo?: RouteLocationRaw;
  }>(),
  {
    isCurrentUser: false,
    secondaryActionLabel: undefined,
    secondaryActionTo: undefined,
  },
);

const availableCategories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];

const bioCopy = computed(() => props.user.bio?.trim() || 'Building a premium Atlas footprint one memorable pin at a time.');
const avatarSource = computed(() => props.user.avatarUrl?.trim() || `https://i.pravatar.cc/240?u=${encodeURIComponent(props.user.id)}`);
const initials = computed(() => getInitials(props.user.displayName));
const profileSignature = computed(() => {
  if (props.user.stats?.spots) {
    return `${props.user.stats.spots} lifetime pin${props.user.stats.spots === 1 ? '' : 's'}`;
  }

  return `${props.user.interests.length || 1} signature vibe${props.user.interests.length === 1 ? '' : 's'}`;
});

function toBadgeCategory(value: string): SpotCategory {
  const normalizedValue = value.trim().toLowerCase();
  return availableCategories.find((category) => category === normalizedValue) ?? 'other';
}

function formatInterest(value: string): string {
  const normalizedValue = value.trim();
  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1);
}

function interestChipClass(value: string): string {
  return `badge-${toBadgeCategory(value)}`;
}
</script>

<style scoped>
.profile-header {
  position: relative;
  isolation: isolate;
  overflow: visible;
  display: grid;
  gap: var(--space-5);
  padding: clamp(var(--space-6), 3vw, var(--space-8));
  padding-top: clamp(6.5rem, 9vw, 7.75rem);
  text-align: center;
  background:
    radial-gradient(circle at top center, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 38%),
    radial-gradient(circle at 18% 100%, color-mix(in srgb, var(--accent-gold) 14%, transparent), transparent 34%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 68%, transparent), var(--glass-bg));
}

.profile-header::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: inherit;
  background: linear-gradient(180deg, color-mix(in srgb, var(--text-primary) 6%, transparent), transparent 18%);
  opacity: 0.9;
  pointer-events: none;
}

.profile-halo {
  position: absolute;
  inset-inline: 50%;
  top: -1.75rem;
  width: 16rem;
  height: 8rem;
  transform: translateX(-50%);
  border-radius: var(--radius-full);
  background: radial-gradient(circle, color-mix(in srgb, var(--accent-teal) 30%, transparent), transparent 68%);
  filter: blur(1rem);
  opacity: 0.85;
  pointer-events: none;
}

.avatar-shell {
  position: absolute;
  inset-inline-start: 50%;
  top: 0;
  transform: translate(-50%, -45%);
  width: 7.5rem;
  height: 7.5rem;
  animation: profile-float 6s ease-in-out infinite;
}

.avatar-ring {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0.4rem;
  border-radius: var(--radius-full);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 70%, transparent), color-mix(in srgb, var(--accent-gold) 18%, transparent)),
    var(--bg-primary);
  box-shadow:
    0 0 0 0.3rem color-mix(in srgb, var(--accent-teal) 14%, transparent),
    var(--shadow-glow-teal);
}

.avatar-image,
.avatar-fallback {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
}

.avatar-image {
  display: block;
  object-fit: cover;
  background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
}

.avatar-fallback {
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--accent-gold) 24%, transparent), transparent 62%),
    linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 24%, transparent), var(--bg-tertiary));
  color: var(--text-primary);
  font-size: 1.65rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.1em;
}

.header-topline,
.interest-row,
.action-row,
.location {
  display: flex;
  align-items: center;
}

.header-topline,
.action-row {
  justify-content: center;
}

.header-topline,
.action-row,
.interest-row {
  flex-wrap: wrap;
  gap: var(--space-3);
}

.header-topline,
.identity-copy,
.location {
  position: relative;
  z-index: 1;
}

.identity-copy {
  display: grid;
  gap: var(--space-3);
  justify-items: center;
}

.eyebrow,
.username,
.location,
.section-copy,
h1,
span,
p {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
  font-weight: var(--font-weight-medium);
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.9rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 70%, transparent);
  background: color-mix(in srgb, var(--bg-elevated) 70%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 10%, transparent);
  color: var(--text-primary);
  font-size: var(--font-size-small);
}

h1 {
  font-size: clamp(var(--font-size-h1), 4vw, 3rem);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.username {
  color: var(--text-secondary);
  font-size: 1.05rem;
}

.location {
  justify-content: center;
  gap: var(--space-2);
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
}

.location :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--accent-teal);
}

.section-copy {
  max-width: 40rem;
}

.interest-row {
  justify-content: center;
  position: relative;
  z-index: 1;
}

.interest-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 0.9rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, transparent);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.action-row {
  position: relative;
  z-index: 1;
}

.action-row :deep(.button) {
  min-width: 11rem;
}

@keyframes profile-float {
  0%,
  100% {
    transform: translate(-50%, -45%);
  }
  50% {
    transform: translate(-50%, -48%);
  }
}

@media (max-width: 720px) {
  .profile-header {
    padding-inline: var(--space-5);
    padding-bottom: var(--space-5);
  }

  .action-row {
    width: 100%;
  }

  .action-row :deep(.button) {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .avatar-shell {
    animation: none;
  }
}
</style>
