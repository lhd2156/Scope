<template>
  <header class="profile-header glass-panel" data-test="profile-header">
    <div class="identity-row">
      <Avatar :name="user.displayName" :src="user.avatarUrl" :size="88" />

      <div class="identity-copy">
        <div class="title-row">
          <div>
            <p class="eyebrow">{{ isCurrentUser ? 'Your atlas' : 'Explorer profile' }}</p>
            <h1>{{ user.displayName }}</h1>
            <p class="meta">@{{ user.username }}<span v-if="user.homeBase"> · {{ user.homeBase }}</span></p>
          </div>

          <div class="action-row">
            <RouterLink :to="primaryActionTo" class="button button-primary">{{ primaryActionLabel }}</RouterLink>
            <RouterLink v-if="secondaryActionLabel && secondaryActionTo" :to="secondaryActionTo" class="button button-secondary">
              {{ secondaryActionLabel }}
            </RouterLink>
          </div>
        </div>

        <p class="section-copy">{{ bioCopy }}</p>

        <div class="interest-row">
          <span v-for="interest in user.interests" :key="interest" class="interest-chip" :class="`badge-${interest}`">
            {{ formatCategory(interest) }}
          </span>
        </div>
      </div>
    </div>

    <div class="summary-grid">
      <article class="surface-card summary-card">
        <small>Total spots</small>
        <strong>{{ user.stats?.spots ?? 0 }}</strong>
        <span>Lifetime pins mapped</span>
      </article>
      <article class="surface-card summary-card">
        <small>Total trips</small>
        <strong>{{ user.stats?.trips ?? 0 }}</strong>
        <span>Collaborative routes planned</span>
      </article>
      <article class="surface-card summary-card">
        <small>Friends</small>
        <strong>{{ user.stats?.friends ?? 0 }}</strong>
        <span>People in the adventure graph</span>
      </article>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import Avatar from '@/components/common/Avatar.vue';
import type { SpotCategory, UserProfile } from '@/types';

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

const bioCopy = computed(() => props.user.bio?.trim() || 'Building a premium Atlas footprint one public pin at a time.');

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
</script>

<style scoped>
.profile-header {
  display: grid;
  gap: var(--space-6);
  padding: var(--space-6);
}

.identity-row,
.title-row,
.action-row,
.interest-row,
.summary-grid {
  display: flex;
  gap: var(--space-4);
}

.identity-row {
  align-items: flex-start;
}

.identity-copy {
  flex: 1;
  display: grid;
  gap: var(--space-4);
}

.title-row {
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

h1,
.meta,
.summary-card small,
.summary-card strong,
.summary-card span {
  margin: 0;
}

h1 {
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: var(--line-height-tight);
}

.meta,
.summary-card small,
.summary-card span {
  color: var(--text-secondary);
}

.meta {
  margin-top: var(--space-2);
}

.action-row {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.interest-row {
  flex-wrap: wrap;
}

.interest-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.summary-card {
  padding: var(--space-4);
  display: grid;
  gap: var(--space-2);
}

.summary-card strong {
  color: var(--text-primary);
  font-size: var(--font-size-h2);
}

@media (max-width: 980px) {
  .title-row,
  .identity-row {
    flex-direction: column;
  }

  .action-row {
    justify-content: flex-start;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .profile-header {
    padding: var(--space-5);
  }

  .action-row {
    width: 100%;
  }

  .action-row :deep(a) {
    width: 100%;
  }
}
</style>
