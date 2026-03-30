<template>
  <article class="feed-item-skeleton glass-panel" aria-hidden="true" data-test="feed-item-skeleton">
    <div class="feed-item-skeleton__header">
      <div class="feed-item-skeleton__actor">
        <SkeletonBlock width="3.25rem" height="3.25rem" shape="circle" />
        <div class="feed-item-skeleton__identity">
          <SkeletonBlock width="7rem" height="0.75rem" />
          <SkeletonBlock width="16rem" height="1.35rem" />
          <SkeletonBlock width="10rem" height="0.9rem" />
        </div>
      </div>

      <SkeletonBlock width="5.5rem" height="2rem" shape="pill" />
    </div>

    <div class="feed-item-skeleton__media" />

    <div class="feed-item-skeleton__footer">
      <div class="feed-item-skeleton__actions">
        <SkeletonBlock width="4.5rem" height="2.75rem" shape="pill" />
        <SkeletonBlock width="4.5rem" height="2.75rem" shape="pill" />
        <SkeletonBlock width="4.5rem" height="2.75rem" shape="pill" />
      </div>

      <SkeletonBlock width="6.5rem" height="2.75rem" shape="pill" />
    </div>
  </article>
</template>

<script setup lang="ts">
import SkeletonBlock from '@/components/common/SkeletonBlock.vue';
</script>

<style scoped>
.feed-item-skeleton {
  overflow: hidden;
  display: grid;
  gap: var(--space-4);
  padding: clamp(var(--space-5), 2vw, var(--space-6));
}

.feed-item-skeleton__header,
.feed-item-skeleton__actor,
.feed-item-skeleton__identity,
.feed-item-skeleton__footer,
.feed-item-skeleton__actions {
  display: grid;
  gap: var(--space-3);
}

.feed-item-skeleton__header,
.feed-item-skeleton__footer {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.feed-item-skeleton__actor {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}

.feed-item-skeleton__identity {
  gap: var(--space-2);
}

.feed-item-skeleton__media {
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 36%),
    radial-gradient(circle at bottom right, var(--accent-gold-light), transparent 34%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.feed-item-skeleton__actions {
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, max-content);
}

@media (max-width: 720px) {
  .feed-item-skeleton__header,
  .feed-item-skeleton__footer {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .feed-item-skeleton__actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-flow: row;
  }
}

@media (max-width: 560px) {
  .feed-item-skeleton__actor {
    grid-template-columns: 1fr;
  }
}
</style>
