<template>
  <article class="feed-item glass-panel">
    <div class="feed-media" :class="`feed-media--${item.type}`">
      <LazyImage v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" class="feed-image" />
      <div v-else class="media-fallback">
        <AtlasIcon :name="item.type === 'trip' ? 'route' : 'pin'" :label="activityLabel" />
        <strong>{{ typeLabel }}</strong>
        <span>Visual update loading</span>
      </div>

      <div class="feed-media-chrome">
        <span class="type-pill">
          <AtlasIcon :name="item.type === 'trip' ? 'route' : 'sparkle'" />
          <span>{{ typeLabel }}</span>
        </span>
        <button
          type="button"
          class="save-button"
          :class="{ active: isSaved }"
          :aria-pressed="isSaved"
          :aria-label="isSaved ? `Remove ${item.title} from saved updates` : `Save ${item.title}`"
          @click="toggleSaved"
        >
          <AtlasIcon :name="isSaved ? 'heart-filled' : 'heart'" />
        </button>
      </div>

      <div class="feed-overlay">
        <p class="overlay-kicker">{{ item.actor.displayName }}</p>
        <p class="overlay-copy">{{ item.excerpt }}</p>
      </div>
    </div>

    <div class="copy">
      <div class="header-row">
        <div class="actor-row">
          <Avatar :name="item.actor.displayName" :src="item.actor.avatarUrl" :size="48" />
          <div class="header-copy">
            <p class="eyebrow">{{ activityLabel }}</p>
            <h3>{{ item.title }}</h3>
            <p class="meta">
              <span v-if="item.actor.homeBase">{{ item.actor.homeBase }}</span>
              <span>{{ relativeTime }}</span>
            </p>
          </div>
        </div>
        <span class="time-pill">{{ relativeTime }}</span>
      </div>

      <div class="stat-group">
        <span>{{ item.actor.stats?.spots ?? 0 }} spots</span>
        <span>{{ item.actor.stats?.trips ?? 0 }} trips</span>
        <span>{{ item.actor.stats?.friends ?? 0 }} friends</span>
      </div>

      <div class="footer-row">
        <p class="footer-copy">{{ footerCopy }}</p>
        <RouterLink class="cta-link" :to="destinationRoute">
          <span>View {{ item.type === 'trip' ? 'trip' : 'spot' }}</span>
          <AtlasIcon name="arrow-right" />
        </RouterLink>
      </div>
    </div>
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

const isSaved = ref(false);

function toggleSaved() {
  isSaved.value = !isSaved.value;
}

const activityLabel = computed(() => (props.item.type === 'trip' ? 'Trip activity' : 'Spot activity'));
const typeLabel = computed(() => (props.item.type === 'trip' ? 'Trip plan' : 'Pinned spot'));
const relativeTime = computed(() => formatRelativeTime(props.item.createdAt));
const destinationRoute = computed(() => (props.item.type === 'trip' ? `/trips/${props.item.targetId}` : `/spots/${props.item.targetId}`));
const footerCopy = computed(() => {
  const friendCount = props.item.actor.stats?.friends ?? 0;
  return friendCount ? `${friendCount} travelers are following this explorer` : 'Open the update for the full story';
});
</script>

<style scoped>
.feed-item {
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 17rem) minmax(0, 1fr);
  min-height: 18rem;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.feed-item:hover,
.feed-item:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
}

.feed-media {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, var(--accent-gold-light), transparent 40%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.feed-media::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 12%, transparent) 0%,
      transparent 32%,
      color-mix(in srgb, var(--bg-primary) 88%, transparent) 100%
    ),
    linear-gradient(0deg, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 40%);
  pointer-events: none;
}

.feed-media--trip {
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 38%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
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
  transform: scale(1.05);
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
  margin: 0;
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
.feed-overlay,
.copy,
.header-copy,
.stat-group,
.footer-row {
  display: grid;
  gap: var(--space-3);
}

.feed-media-chrome {
  position: absolute;
  inset: var(--space-4) var(--space-4) auto;
  z-index: 1;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.feed-overlay {
  position: absolute;
  inset-inline: var(--space-4);
  bottom: var(--space-4);
  z-index: 1;
}

.overlay-kicker,
.overlay-copy,
.eyebrow,
h3,
.meta,
.footer-copy {
  margin: 0;
}

.overlay-kicker {
  color: color-mix(in srgb, var(--text-primary) 78%, var(--text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.overlay-copy {
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: 1.45;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.copy {
  padding: var(--space-6);
}

.header-row,
.actor-row,
.meta {
  display: flex;
  gap: var(--space-3);
}

.header-row,
.footer-row {
  align-items: flex-start;
  justify-content: space-between;
}

.actor-row {
  align-items: center;
}

.header-copy {
  gap: var(--space-2);
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: var(--font-size-caption);
}

h3 {
  font-size: var(--font-size-h3);
  line-height: 1.2;
}

.meta,
.footer-copy {
  color: var(--text-secondary);
}

.meta {
  flex-wrap: wrap;
  font-size: var(--font-size-small);
}

.time-pill,
.type-pill,
.stat-group span,
.save-button {
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.time-pill,
.type-pill,
.stat-group span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: fit-content;
  padding: 0.55rem 0.85rem;
  background: color-mix(in srgb, var(--glass-bg) 100%, transparent);
  box-shadow: var(--shadow-sm);
  font-size: var(--font-size-small);
}

.type-pill,
.stat-group span {
  color: var(--text-primary);
}

.type-pill :deep(.atlas-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-teal);
}

.stat-group {
  grid-template-columns: repeat(3, minmax(0, max-content));
  align-items: start;
}

.save-button {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  background: color-mix(in srgb, var(--glass-bg) 90%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    background var(--transition-fast);
}

.save-button:hover,
.save-button:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 55%, var(--glass-border));
  box-shadow: var(--shadow-glow-teal);
  outline: none;
}

.save-button.active {
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--glass-bg));
}

.save-button:active {
  transform: translateY(0) scale(0.97);
}

.save-button :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
}

.cta-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: fit-content;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 36%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.cta-link:hover,
.cta-link:focus-visible {
  transform: translateY(-1px);
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  outline: none;
}

.cta-link :deep(.atlas-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

@media (max-width: 960px) {
  .feed-item {
    grid-template-columns: 1fr;
  }

  .feed-media {
    min-height: 15rem;
  }

  .stat-group {
    grid-template-columns: repeat(2, minmax(0, max-content));
  }
}

@media (max-width: 720px) {
  .copy {
    padding: var(--space-4);
  }

  .header-row,
  .footer-row,
  .feed-media-chrome,
  .stat-group {
    grid-template-columns: 1fr;
  }

  .header-row,
  .actor-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .time-pill {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .feed-item,
  .feed-image,
  .save-button,
  .cta-link {
    transition: none;
  }

  .feed-item:hover,
  .feed-item:focus-within,
  .feed-item:hover .feed-image,
  .feed-item:focus-within .feed-image,
  .save-button:hover,
  .save-button:focus-visible,
  .save-button:active,
  .cta-link:hover,
  .cta-link:focus-visible {
    transform: none;
  }
}
</style>
