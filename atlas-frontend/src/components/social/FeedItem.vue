<template>
  <article class="feed-item glass-panel">
    <div class="media" :class="`media-${item.type}`">
      <LazyImage v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" class="feed-image" />
      <div v-else class="media-fallback">
        <AtlasIcon :name="item.type === 'trip' ? 'route' : 'pin'" :label="activityLabel" />
      </div>
    </div>

    <div class="copy">
      <div class="header-row">
        <div class="actor-row">
          <Avatar :name="item.actor.displayName" :src="item.actor.avatarUrl" :size="48" />
          <div>
            <p class="eyebrow">{{ activityLabel }}</p>
            <h3>{{ item.title }}</h3>
            <p class="meta">
              {{ item.actor.displayName }}
              <span v-if="item.actor.homeBase">· {{ item.actor.homeBase }}</span>
              <span>· {{ relativeTime }}</span>
            </p>
          </div>
        </div>
        <span class="type-pill">
          <AtlasIcon :name="item.type === 'trip' ? 'calendar' : 'sparkle'" />
          {{ item.type === 'trip' ? 'Trip plan' : 'Pinned spot' }}
        </span>
      </div>

      <p class="excerpt">{{ item.excerpt }}</p>

      <div class="footer-row">
        <div class="stat-group">
          <span>{{ item.actor.stats?.spots ?? 0 }} spots</span>
          <span>{{ item.actor.stats?.trips ?? 0 }} trips</span>
          <span>{{ item.actor.stats?.friends ?? 0 }} friends</span>
        </div>
        <RouterLink class="cta-link" :to="destinationRoute">
          View {{ item.type === 'trip' ? 'trip' : 'spot' }}
        </RouterLink>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/common/Avatar.vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import type { FeedItem as FeedItemModel } from '@/types';
import { formatRelativeTime } from '@/utils/formatters';

const props = defineProps<{
  item: FeedItemModel;
}>();

const activityLabel = computed(() => (props.item.type === 'trip' ? 'Trip activity' : 'Spot activity'));
const relativeTime = computed(() => formatRelativeTime(props.item.createdAt));
const destinationRoute = computed(() => (props.item.type === 'trip' ? `/trips/${props.item.targetId}` : `/spots/${props.item.targetId}`));
</script>

<style scoped>
.feed-item {
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 16rem) minmax(0, 1fr);
  min-height: 14rem;
}

.media {
  position: relative;
  min-height: 100%;
  background: radial-gradient(circle at top, var(--accent-gold-light), transparent 52%), var(--bg-secondary);
}

.media-spot {
  border-right: 1px solid var(--glass-border);
}

.media-trip {
  border-right: 1px solid var(--glass-border);
}

.feed-image,
.media-fallback {
  width: 100%;
  height: 100%;
}

.feed-image {
  object-fit: cover;
}

.media-fallback {
  display: grid;
  place-items: center;
  color: var(--accent-teal);
  font-size: 2.5rem;
}

.copy {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
}

.header-row,
.actor-row,
.footer-row,
.stat-group {
  display: flex;
  gap: var(--space-4);
}

.header-row,
.footer-row {
  justify-content: space-between;
  align-items: flex-start;
}

.actor-row {
  align-items: center;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: var(--font-size-caption);
}

h3 {
  margin: 0;
  font-size: var(--font-size-h2);
}

.meta,
.excerpt,
.stat-group {
  color: var(--text-secondary);
}

.meta,
.excerpt {
  margin: 0;
}

.excerpt {
  line-height: var(--line-height-relaxed);
}

.type-pill,
.stat-group span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  padding: 0.45rem 0.8rem;
  font-size: var(--font-size-small);
}

.type-pill {
  color: var(--text-primary);
  white-space: nowrap;
}

.stat-group {
  flex-wrap: wrap;
}

.cta-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.cta-link:hover,
.cta-link:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-glow-teal);
  transform: translateY(-0.0625rem);
  outline: none;
}

@media (max-width: 960px) {
  .feed-item {
    grid-template-columns: 1fr;
  }

  .media {
    min-height: 12rem;
    border-right: none;
    border-bottom: 1px solid var(--glass-border);
  }
}

@media (max-width: 720px) {
  .header-row,
  .footer-row {
    flex-direction: column;
  }

  .actor-row {
    align-items: flex-start;
  }

  .cta-link {
    width: fit-content;
  }
}
</style>
