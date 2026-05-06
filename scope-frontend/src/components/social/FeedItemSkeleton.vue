<template>
  <article class="feed-item-skeleton glass-panel" aria-hidden="true" data-test="feed-item-skeleton">
    <div class="feed-item-skeleton__header">
      <div class="feed-item-skeleton__actor">
        <SkeletonBlock width="2.25rem" height="2.25rem" shape="circle" />
        <div class="feed-item-skeleton__identity">
          <SkeletonBlock width="6rem" height="0.65rem" />
          <SkeletonBlock width="13rem" height="1.1rem" />
          <SkeletonBlock width="8rem" height="0.75rem" />
        </div>
      </div>

      <SkeletonBlock width="4.75rem" height="1.75rem" shape="pill" />
    </div>

    <div class="feed-item-skeleton__media" />

    <div class="feed-item-skeleton__footer">
      <div class="feed-item-skeleton__actions">
        <SkeletonBlock width="3.6rem" height="2.15rem" shape="pill" />
        <SkeletonBlock width="3.6rem" height="2.15rem" shape="pill" />
        <SkeletonBlock width="3.6rem" height="2.15rem" shape="pill" />
      </div>

      <SkeletonBlock width="5.5rem" height="2.15rem" shape="pill" />
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
  padding: clamp(var(--space-4), 1.8vw, var(--space-5));
}

.feed-item-skeleton__header,
.feed-item-skeleton__actor,
.feed-item-skeleton__identity,
.feed-item-skeleton__footer,
.feed-item-skeleton__actions {
  display: grid;
  gap: var(--space-2);
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
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-lg);
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
