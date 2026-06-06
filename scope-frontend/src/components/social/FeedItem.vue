<template>
  <article class="feed-item glass-panel" :data-test="`feed-item-${item.id}`">
    <header class="feed-header">
      <div class="actor-row">
        <Avatar :name="item.actor.displayName" :src="item.actor.avatarUrl" :size="36" />

        <div class="header-copy">
          <p class="eyebrow">{{ activityLabel }}</p>
          <h3 class="headline-copy">{{ headlineCopy }}</h3>
          <p class="meta">
            <span class="meta__location">{{ locationCopy }}</span>
            <span class="meta__time">{{ relativeTime }}</span>
          </p>
        </div>
      </div>
    </header>

    <RouterLink class="feed-media" :to="destinationRoute">
      <LazyImage :src="feedImageUrl" :fallback-src="feedImageFallback" :alt="item.title" class="feed-image" />

      <div class="feed-media-chrome">
        <span class="type-pill" :class="`type-pill--${item.type}`">
          <ScopeIcon :name="typeIcon" />
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
          :data-test="`feed-like-${item.id}`"
          type="button"
          class="action-button"
          :class="{ 'action-button--active': isLiked, 'action-button--gated': isEngagementGated }"
          :aria-pressed="isLiked"
          :aria-label="isLiked ? `Unlike ${item.title}` : `Like ${item.title}`"
          :title="engagementTitle('like')"
          @click="handleLike"
        >
          <!--
            Inline SVGs instead of sprite <use> references so the engagement
            row is readable even when the sprite file fails to paint (which
            caused the row to collapse into numeric-only pills in demo mode).
          -->
          <svg
            v-if="isLiked"
            class="action-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <svg
            v-else
            class="action-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span class="action-count">{{ likeCount }}</span>
        </button>

        <button
          :data-test="`feed-comment-${item.id}`"
          type="button"
          class="action-button"
          :class="{ 'action-button--gated': isEngagementGated }"
          :aria-label="`Comment on ${item.title}`"
          :title="engagementTitle('comment')"
          @click="handleComment"
        >
          <svg
            class="action-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V11.5A8.5 8.5 0 0 1 11.5 3h1A8.5 8.5 0 0 1 21 11.5z"/>
          </svg>
          <span class="action-count">{{ commentCount }}</span>
        </button>

        <button
          :data-test="`feed-share-${item.id}`"
          type="button"
          class="action-button"
          :class="{ 'action-button--active': isShared, 'action-button--gated': isEngagementGated }"
          :aria-pressed="isShared"
          :aria-label="isShared ? `Shared ${item.title}` : `Share ${item.title}`"
          :title="engagementTitle('share')"
          @click="handleShare"
        >
          <svg
            class="action-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span class="action-count">{{ shareCount }}</span>
        </button>
      </div>

      <RouterLink class="cta-link" :to="destinationRoute">{{ destinationLabel }}</RouterLink>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Avatar from '@/components/common/Avatar.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import type { FeedItem as FeedItemModel } from '@/types';
import { formatRelativeTime } from '@/utils/formatters';
import { getFeedPhotoFallback, resolveFeedImageUrl } from '@/utils/imageFallbacks';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';

const props = withDefaults(
  defineProps<{
    item: FeedItemModel;
    preview?: boolean;
  }>(),
  {
    preview: false,
  },
);

const router = useRouter();
const authStore = useAuthStore();
const toastStore = useToastStore();

const isLiked = ref(false);
const isShared = ref(false);

const isEngagementGated = computed(() => props.preview || !authStore.isAuthenticated);

type EngagementKind = 'like' | 'comment' | 'share';

function engagementTitle(kind: EngagementKind): string {
  if (props.preview) {
    return 'Scope activity.';
  }

  if (!authStore.isAuthenticated) {
    return 'Sign in to join the conversation.';
  }

  if (kind === 'like') {
    return isLiked.value ? 'Unlike' : 'Like';
  }

  if (kind === 'share') {
    return isShared.value ? 'Shared' : 'Share';
  }

  return 'Comments';
}

function emitPreviewToast(): void {
  toastStore.showInfo({
    title: 'Scope activity',
    message: 'Sign in to like, comment, and share live Scope activity.',
  });
}

function emitSignInPrompt(intent: EngagementKind): void {
  const messages: Record<EngagementKind, string> = {
    like: 'Sign in to like posts and keep your favorite moments front and center.',
    comment: 'Sign in to join the conversation on this Scope post.',
    share: 'Sign in to share this Scope moment with your crew.',
  };

  toastStore.showInfo({
    title: 'Sign in required',
    message: messages[intent],
  });

  const redirectTarget = router.currentRoute.value.fullPath ?? '/';
  router.push({ path: '/login', query: { redirect: redirectTarget } }).catch(() => undefined);
}

function resolveEngagementIntent(kind: EngagementKind): boolean {
  if (props.preview) {
    emitPreviewToast();
    return false;
  }

  if (!authStore.isAuthenticated) {
    emitSignInPrompt(kind);
    return false;
  }

  return true;
}

function handleLike(): void {
  if (!resolveEngagementIntent('like')) {
    return;
  }

  isLiked.value = !isLiked.value;
}

function handleShare(): void {
  if (!resolveEngagementIntent('share')) {
    return;
  }

  isShared.value = !isShared.value;
}

function handleComment(): void {
  if (!resolveEngagementIntent('comment')) {
    return;
  }

  router.push(destinationRoute.value).catch(() => undefined);
}

const ACTION_START_WORDS = new Set([
  'added',
  'completed',
  'dropped',
  'finished',
  'left',
  'logged',
  'pinned',
  'planned',
  'published',
  'reviewed',
  'saved',
  'shared',
]);

function trimActorPrefix(title: string, actor: FeedItemModel['actor']): string {
  const normalizedTitle = title.trim();
  const actorPrefixes = [
    actor.displayName,
    actor.displayName?.split(/\s+/)[0],
    actor.username,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (!actorPrefixes.length) {
    return normalizedTitle;
  }

  const matchedPrefix = actorPrefixes.find((prefix) => {
    const lowerTitle = normalizedTitle.toLowerCase();
    const lowerPrefix = prefix.toLowerCase();

    return lowerTitle === lowerPrefix || lowerTitle.startsWith(`${lowerPrefix} `);
  });

  return matchedPrefix ? normalizedTitle.slice(matchedPrefix.length).trim() : normalizedTitle;
}

function normalizeActivityCopy(title: string, actor: FeedItemModel['actor']): string {
  const trimmedTitle = trimActorPrefix(title, actor).replace(/^[\s:,-]+/, '').trim();
  const firstWordMatch = trimmedTitle.match(/^([A-Za-z]+)/);

  if (!firstWordMatch) {
    return trimmedTitle;
  }

  const firstWord = firstWordMatch[1];
  if (!ACTION_START_WORDS.has(firstWord.toLowerCase())) {
    return trimmedTitle;
  }

  return `${firstWord.toLowerCase()}${trimmedTitle.slice(firstWord.length)}`;
}

function resolveActorDisplayName(actor: FeedItemModel['actor']): string {
  return actor.displayName?.trim() || actor.username?.trim() || 'Scope traveler';
}

function resolveHeadlineCopy(title: string, actor: FeedItemModel['actor']): string {
  const actorName = resolveActorDisplayName(actor);
  const activityCopy = normalizeActivityCopy(title, actor);

  return activityCopy ? `${actorName} ${activityCopy}` : actorName;
}

function resolveActivityLabel(title: string, type: FeedItemModel['type']): string {
  const normalizedTitle = title.toLowerCase();

  if (normalizedTitle.includes('pinned') || normalizedTitle.includes('dropped')) {
    return 'Dropped a pin';
  }

  if (normalizedTitle.includes('planned')) {
    return 'Planned a route';
  }

  if (normalizedTitle.includes('review')) {
    return 'Wrote a review';
  }

  if (normalizedTitle.includes('completed')) {
    return 'Completed a trip';
  }

  return type === 'trip' ? 'Trip activity' : 'Spot activity';
}

const activityLabel = computed(() => resolveActivityLabel(props.item.title, props.item.type));
const headlineCopy = computed(() => resolveHeadlineCopy(props.item.title, props.item.actor));
const relativeTime = computed(() => formatRelativeTime(props.item.createdAt));
const destinationRoute = computed(() => (props.item.type === 'trip' ? `/trips/${props.item.targetId}` : `/spots/${props.item.targetId}`));
const typeLabel = computed(() => {
  if (props.item.type === 'trip') {
    return 'Trip update';
  }
  return props.item.type === 'review' ? 'Place review' : 'Pinned spot';
});
const destinationLabel = computed(() => (props.item.type === 'trip' ? 'Open trip' : 'Open spot'));
const typeIcon = computed(() => {
  if (props.item.type === 'trip') {
    return 'route';
  }
  return props.item.type === 'review' ? 'star' : 'pin';
});
const overlayTitle = computed(() => {
  if (props.item.type === 'trip') {
    return 'Route snapshot';
  }
  return props.item.type === 'review' ? 'Review note' : 'Pinned moment';
});
const locationCopy = computed(() => props.item.actor.homeBase?.trim() || 'Scope community');
const FEED_IMAGE_WIDTH = 960;

const feedImageFallback = computed(() => getFeedPhotoFallback(props.item, FEED_IMAGE_WIDTH));
const feedImageUrl = computed(() => resolveFeedImageUrl(props.item, FEED_IMAGE_WIDTH));

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
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.feed-item {
  --feed-header-block-size: 5.85rem;
  --feed-media-aspect-ratio: 4 / 3;

  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-rows: var(--feed-header-block-size) auto minmax(0, 1fr);
  align-content: start;
  gap: var(--space-4);
  padding: clamp(var(--space-4), 1.8vw, var(--space-5));
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
  gap: var(--space-2);
}

.feed-header {
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  min-height: 0;
  height: var(--feed-header-block-size);
  overflow: hidden;
}

.feed-footer {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  align-self: end;
  column-gap: var(--space-3);
  padding-top: var(--space-2);
}

.actor-row {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: flex-start;
  gap: var(--space-3);
  min-height: 0;
  height: 100%;
}

.header-copy {
  grid-template-rows: 0.95rem 2.4rem 1.35rem;
  align-content: start;
  gap: 0.35rem;
  min-width: 0;
  min-height: 0;
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
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-copy h3,
.headline-copy {
  color: var(--text-primary);
  font-size: 0.92rem;
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
  min-height: 2.4rem;
  max-height: 2.4rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.meta {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: nowrap;
  min-width: 0;
  min-height: 1.35rem;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: 1.35;
  white-space: nowrap;
}

.meta__location {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta__time {
  flex: 0 0 auto;
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
  gap: 0.4rem;
  width: fit-content;
  padding: 0.45rem 0.7rem;
  background: color-mix(in srgb, var(--glass-bg) 100%, transparent);
  box-shadow: var(--shadow-sm);
  font-size: var(--font-size-small);
  color: var(--text-primary);
}

.feed-media {
  position: relative;
  isolation: isolate;
  display: block;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  aspect-ratio: var(--feed-media-aspect-ratio);
  border-radius: var(--radius-lg);
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

.feed-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: transform var(--transition-slow), filter var(--transition-slow);
}

.feed-item:hover .feed-image,
.feed-item:focus-within .feed-image {
  transform: scale(var(--motion-image-zoom-subtle));
}

.feed-media-chrome,
.feed-overlay {
  position: absolute;
  z-index: 1;
}

.feed-media-chrome {
  top: var(--space-3);
  left: var(--space-3);
  right: var(--space-3);
}

.feed-overlay {
  bottom: var(--space-3);
  left: var(--space-3);
  right: var(--space-3);
  gap: var(--space-2);
}

.overlay-title {
  color: color-mix(in srgb, var(--text-primary) 76%, var(--text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
  font-weight: var(--font-weight-semibold);
}

.overlay-copy {
  max-width: 24rem;
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.4;
  text-shadow: var(--shadow-md);
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.type-pill {
  font-weight: var(--font-weight-semibold);
}

.type-pill :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

.type-pill--trip {
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--glass-bg));
}

.type-pill--trip :deep(.scope-icon) {
  color: var(--accent-teal);
}

.type-pill--spot {
  background: color-mix(in srgb, var(--accent-gold) 18%, var(--glass-bg));
}

.type-pill--spot :deep(.scope-icon) {
  color: var(--accent-gold);
}

.type-pill--review {
  background: color-mix(in srgb, var(--accent-gold) 22%, var(--glass-bg));
}

.type-pill--review :deep(.scope-icon) {
  color: var(--accent-gold);
}

.feed-footer {
  gap: var(--space-3);
}

.action-group {
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, max-content);
  align-items: center;
  gap: var(--space-2);
}

.action-button,
.cta-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: fit-content;
  min-height: 2.15rem;
  padding: 0.42rem 0.7rem;
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
  padding-inline: 0.65rem;
  gap: 0.35rem;
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

.action-button :deep(.scope-icon),
.cta-link :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.action-icon {
  /*
   * Explicit pixel sizing so the engagement icons render reliably even when
   * the parent button collapses font-size or when the sprite file has yet
   * to paint. Width + height are set directly on the SVG (not just CSS)
   * to guard against any CSS reset that might zero them out.
   */
  width: 0.95rem;
  height: 0.95rem;
  flex-shrink: 0;
  color: currentColor;
  display: inline-block;
}

.action-count {
  font-variant-numeric: tabular-nums;
  font-size: var(--font-size-small);
}

.cta-link {
  padding-inline: 1rem;
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
  color: var(--text-primary);
}

.action-button--gated {
  cursor: help;
}

.action-button--gated:hover,
.action-button--gated:focus-visible {
  border-color: color-mix(in srgb, var(--accent-gold) 45%, var(--glass-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-gold) 28%, transparent);
  color: var(--text-primary);
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
    grid-template-columns: auto minmax(0, 1fr);
  }

  .feed-media-chrome {
    top: var(--space-4);
    left: var(--space-4);
    right: var(--space-4);
  }

  .feed-overlay {
    bottom: var(--space-4);
    left: var(--space-4);
    right: var(--space-4);
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
