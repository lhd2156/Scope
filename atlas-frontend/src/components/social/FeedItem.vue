<template>
  <article class="feed-item glass-panel">
    <header class="feed-header">
      <div class="actor-row">
        <Avatar :name="item.actor.displayName" :src="item.actor.avatarUrl" :size="52" />

        <div class="header-copy">
          <p class="eyebrow">{{ activityLabel }}</p>
          <h3>
            <span class="actor-name">{{ item.actor.displayName }}</span>
            <span class="headline-copy">{{ headlineCopy }}</span>
          </h3>
          <p class="meta">
            <span>{{ locationCopy }}</span>
            <span class="meta-divider" aria-hidden="true" />
            <span>{{ relativeTime }}</span>
          </p>
        </div>
      </div>

      <span class="time-pill">{{ relativeTime }}</span>
    </header>

    <RouterLink class="feed-media" :to="destinationRoute" :aria-label="`Open ${item.title}`">
      <LazyImage v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" class="feed-image" />
      <div v-else class="media-fallback">
        <AtlasIcon :name="typeIcon" :label="activityLabel" />
        <strong>{{ typeLabel }}</strong>
        <span>Travel photo loading</span>
      </div>

      <div class="feed-media-chrome">
        <span class="type-pill" :class="`type-pill--${item.type}`">
          <AtlasIcon :name="typeIcon" />
          <span>{{ typeLabel }}</span>
        </span>
      </div>

      <div class="feed-overlay">
        <p class="overlay-title">{{ overlayTitle }}</p>
        <p class="overlay-copy">{{ item.excerpt }}</p>
      </div>
    </RouterLink>

    <footer class="feed-footer">
      <div class="action-group" aria-label="Feed engagement actions">
        <button
          type="button"
          class="action-button"
          :class="{ 'action-button--active': isLiked }"
          :aria-pressed="isLiked"
          :aria-label="isLiked ? `Unlike ${item.title}` : `Like ${item.title}`"
          @click="toggleLiked"
        >
          <AtlasIcon :name="isLiked ? 'heart-filled' : 'heart'" />
          <span>{{ likeCount }}</span>
        </button>

        <RouterLink class="action-button" :to="destinationRoute" :aria-label="`Comment on ${item.title}`">
          <AtlasIcon name="message-circle" />
          <span>{{ commentCount }}</span>
        </RouterLink>

        <button
          type="button"
          class="action-button"
          :class="{ 'action-button--active': isShared }"
          :aria-pressed="isShared"
          :aria-label="isShared ? `Shared ${item.title}` : `Share ${item.title}`"
          @click="toggleShared"
        >
          <AtlasIcon name="share" />
          <span>{{ shareCount }}</span>
        </button>
      </div>

      <RouterLink class="cta-link" :to="destinationRoute">
        <span>{{ destinationLabel }}</span>
        <AtlasIcon name="arrow-right" />
      </RouterLink>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Avatar from '@/components/common/Avatar.vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import type { FeedItem as FeedItemModel } from '@/types';
import { formatRelativeTime } from '@/utils/formatters';

const props = defineProps<{
  item: FeedItemModel;
}>();

const isLiked = ref(false);
const isShared = ref(false);

function toggleLiked() {
  isLiked.value = !isLiked.value;
}

function toggleShared() {
  isShared.value = !isShared.value;
}

function trimActorPrefix(title: string, actorName: string): string {
  const normalizedTitle = title.trim();
  const normalizedActor = actorName.trim();

  if (!normalizedActor) {
    return normalizedTitle;
  }

  const lowerTitle = normalizedTitle.toLowerCase();
  const lowerActor = normalizedActor.toLowerCase();

  if (lowerTitle.startsWith(lowerActor)) {
    return normalizedTitle.slice(normalizedActor.length).trim();
  }

  return normalizedTitle;
}

function resolveActivityLabel(title: string, type: FeedItemModel['type']): string {
  const normalizedTitle = title.toLowerCase();

  if (normalizedTitle.includes('pinned') || normalizedTitle.includes('dropped')) {
    return 'Dropped a pin';
  }

  if (normalizedTitle.includes('planned')) {
    return 'Planned a route';
  }

  if (normalizedTitle.includes('completed')) {
    return 'Completed a trip';
  }

  if (normalizedTitle.includes('review')) {
    return 'Wrote a review';
  }

  return type === 'trip' ? 'Trip activity' : 'Spot activity';
}

const activityLabel = computed(() => resolveActivityLabel(props.item.title, props.item.type));
const headlineCopy = computed(() => trimActorPrefix(props.item.title, props.item.actor.displayName));
const relativeTime = computed(() => formatRelativeTime(props.item.createdAt));
const destinationRoute = computed(() => (props.item.type === 'trip' ? `/trips/${props.item.targetId}` : `/spots/${props.item.targetId}`));
const typeLabel = computed(() => (props.item.type === 'trip' ? 'Trip update' : 'Pinned spot'));
const destinationLabel = computed(() => (props.item.type === 'trip' ? 'Open trip' : 'Open spot'));
const typeIcon = computed(() => (props.item.type === 'trip' ? 'route' : 'pin'));
const overlayTitle = computed(() => (props.item.type === 'trip' ? 'Route snapshot' : 'Pinned moment'));
const locationCopy = computed(() => props.item.actor.homeBase?.trim() || 'Atlas community');

const baseLikeCount = computed(() => {
  const friendSeed = props.item.actor.stats?.friends ?? 48;
  return Math.max(12, Math.min(320, Math.round(friendSeed / (props.item.type === 'trip' ? 3.5 : 4.5))));
});

const commentCount = computed(() => {
  const tripSeed = props.item.actor.stats?.trips ?? 6;
  return Math.max(3, Math.min(48, tripSeed + (props.item.type === 'trip' ? 4 : 2)));
});

const baseShareCount = computed(() => {
  const spotSeed = props.item.actor.stats?.spots ?? 10;
  return Math.max(1, Math.min(36, Math.round(spotSeed / 6)));
});

const likeCount = computed(() => baseLikeCount.value + (isLiked.value ? 1 : 0));
const shareCount = computed(() => baseShareCount.value + (isShared.value ? 1 : 0));
</script>

<style scoped>
.feed-item {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: var(--space-4);
  padding: clamp(var(--space-5), 2vw, var(--space-6));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 38%),
    radial-gradient(circle at bottom left, color-mix(in srgb, var(--accent-gold) 10%, transparent), transparent 34%),
    var(--glass-bg);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.feed-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--text-primary) 5%, transparent) 0%, transparent 42%),
    linear-gradient(320deg, color-mix(in srgb, var(--accent-teal) 10%, transparent), transparent 44%);
  pointer-events: none;
}

.feed-item > * {
  position: relative;
  z-index: 1;
}

.feed-item:hover,
.feed-item:focus-within {
  transform: translateY(var(--motion-card-lift));
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
}

.feed-header,
.actor-row,
.header-copy,
.feed-overlay,
.feed-footer,
.action-group {
  display: grid;
  gap: var(--space-3);
}

.feed-header,
.feed-footer {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.actor-row {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}

.header-copy {
  gap: var(--space-2);
  min-width: 0;
}

.eyebrow,
.meta,
.overlay-title,
.overlay-copy,
.header-copy h3 {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.header-copy h3 {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--text-primary);
  font-size: var(--font-size-h3);
  line-height: 1.35;
}

.actor-name {
  font-weight: var(--font-weight-semibold);
}

.headline-copy {
  color: color-mix(in srgb, var(--text-primary) 92%, var(--text-secondary));
}

.meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.meta-divider {
  width: 0.25rem;
  height: 0.25rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--text-secondary) 55%, transparent);
}

.time-pill,
.type-pill,
.action-button,
.cta-link {
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.time-pill,
.type-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: fit-content;
  padding: 0.55rem 0.9rem;
  background: color-mix(in srgb, var(--glass-bg) 100%, transparent);
  box-shadow: var(--shadow-sm);
  font-size: var(--font-size-small);
  color: var(--text-primary);
}

.feed-media {
  position: relative;
  isolation: isolate;
  display: block;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 38%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
  box-shadow: var(--shadow-md);
}

.feed-media::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 12%, transparent) 0%, transparent 34%, color-mix(in srgb, var(--bg-primary) 88%, transparent) 100%),
    linear-gradient(0deg, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 46%);
  pointer-events: none;
}

.feed-image,
.media-fallback {
  width: 100%;
  height: 100%;
}

.feed-image {
  object-fit: cover;
  transition: transform var(--transition-slow), filter var(--transition-slow);
}

.feed-item:hover .feed-image,
.feed-item:focus-within .feed-image {
  transform: scale(var(--motion-image-zoom-subtle));
}

.media-fallback {
  display: grid;
  place-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
}

.media-fallback strong {
  color: var(--text-primary);
  font-size: var(--font-size-h3);
}

.media-fallback :deep(.atlas-icon) {
  width: 2rem;
  height: 2rem;
  margin: 0 auto;
  color: var(--accent-teal);
}

.feed-media-chrome,
.feed-overlay {
  position: absolute;
  inset-inline: var(--space-4);
  z-index: 1;
}

.feed-media-chrome {
  top: var(--space-4);
}

.feed-overlay {
  bottom: var(--space-4);
  gap: var(--space-2);
}

.overlay-title {
  color: color-mix(in srgb, var(--text-primary) 76%, var(--text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.overlay-copy {
  max-width: 32rem;
  color: var(--text-primary);
  font-size: clamp(var(--font-size-body), 1.5vw, var(--font-size-h3));
  line-height: 1.45;
  text-shadow: var(--shadow-md);
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.type-pill {
  font-weight: var(--font-weight-semibold);
}

.type-pill :deep(.atlas-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

.type-pill--trip {
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--glass-bg));
}

.type-pill--trip :deep(.atlas-icon) {
  color: var(--accent-teal);
}

.type-pill--spot {
  background: color-mix(in srgb, var(--accent-gold) 18%, var(--glass-bg));
}

.type-pill--spot :deep(.atlas-icon) {
  color: var(--accent-gold);
}

.feed-footer {
  gap: var(--space-4);
}

.action-group {
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, max-content);
  align-items: center;
}

.action-button,
.cta-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: fit-content;
  min-height: 2.75rem;
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--glass-bg) 88%, transparent);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.action-button {
  padding-inline: 0.9rem;
}

.action-button:hover,
.action-button:focus-visible,
.cta-link:hover,
.cta-link:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 55%, var(--glass-border));
  box-shadow: var(--shadow-glow-teal);
  outline: none;
}

.action-button:active,
.cta-link:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.action-button--active {
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--glass-bg));
}

.action-button :deep(.atlas-icon),
.cta-link :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
}

.cta-link {
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
}

@media (max-width: 720px) {
  .feed-header,
  .feed-footer {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .action-group {
    grid-auto-flow: row;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .action-button,
  .cta-link {
    width: 100%;
  }

  .time-pill {
    display: none;
  }
}

@media (max-width: 560px) {
  .actor-row {
    grid-template-columns: 1fr;
  }

  .feed-media-chrome,
  .feed-overlay {
    inset-inline: var(--space-3);
  }

  .feed-media-chrome {
    top: var(--space-3);
  }

  .feed-overlay {
    bottom: var(--space-3);
  }

  .overlay-copy {
    -webkit-line-clamp: 4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .feed-item,
  .feed-image,
  .action-button,
  .cta-link {
    transition: none;
  }

  .feed-item:hover,
  .feed-item:focus-within,
  .feed-item:hover .feed-image,
  .feed-item:focus-within .feed-image,
  .action-button:hover,
  .action-button:focus-visible,
  .action-button:active,
  .cta-link:hover,
  .cta-link:focus-visible,
  .cta-link:active {
    transform: none;
  }
}
</style>
