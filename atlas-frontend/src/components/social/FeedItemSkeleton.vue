<template>
  <article class="feed-item-skeleton glass-panel" aria-hidden="true" data-test="feed-item-skeleton">
    <div class="feed-item-skeleton__media" />

    <div class="feed-item-skeleton__copy">
      <div class="feed-item-skeleton__header">
        <div class="feed-item-skeleton__actor">
          <SkeletonBlock width="3rem" height="3rem" shape="circle" />
          <div class="feed-item-skeleton__identity">
            <SkeletonBlock width="6rem" height="0.75rem" />
            <SkeletonBlock width="12rem" height="1.5rem" />
            <SkeletonBlock width="10rem" height="0.95rem" />
          </div>
        </div>
        <SkeletonBlock width="6.5rem" height="1.75rem" shape="pill" />
      </div>

      <div class="feed-item-skeleton__excerpt">
        <SkeletonBlock width="100%" height="0.95rem" />
        <SkeletonBlock width="94%" height="0.95rem" />
        <SkeletonBlock width="72%" height="0.95rem" />
      </div>

      <div class="feed-item-skeleton__footer">
        <div class="feed-item-skeleton__stats">
          <SkeletonBlock width="4.25rem" height="1.7rem" shape="pill" />
          <SkeletonBlock width="4.25rem" height="1.7rem" shape="pill" />
          <SkeletonBlock width="4.75rem" height="1.7rem" shape="pill" />
        </div>
        <SkeletonBlock width="6.5rem" height="2.75rem" shape="pill" />
      </div>
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
  grid-template-columns: minmax(0, 16rem) minmax(0, 1fr);
  min-height: 14rem;
}

.feed-item-skeleton__media {
  min-height: 100%;
  background: radial-gradient(circle at top, var(--accent-gold-light), transparent 52%), var(--bg-secondary);
  border-right: 1px solid var(--glass-border);
}

.feed-item-skeleton__copy,
.feed-item-skeleton__identity,
.feed-item-skeleton__excerpt {
  display: grid;
  gap: var(--space-4);
}

.feed-item-skeleton__copy {
  padding: var(--space-6);
  gap: var(--space-5);
}

.feed-item-skeleton__header,
.feed-item-skeleton__actor,
.feed-item-skeleton__footer,
.feed-item-skeleton__stats {
  display: flex;
  gap: var(--space-4);
}

.feed-item-skeleton__header,
.feed-item-skeleton__footer {
  justify-content: space-between;
  align-items: flex-start;
}

.feed-item-skeleton__actor {
  align-items: center;
}

.feed-item-skeleton__stats {
  flex-wrap: wrap;
}

@media (max-width: 960px) {
  .feed-item-skeleton {
    grid-template-columns: 1fr;
  }

  .feed-item-skeleton__media {
    min-height: 12rem;
    border-right: none;
    border-bottom: 1px solid var(--glass-border);
  }
}

@media (max-width: 720px) {
  .feed-item-skeleton__header,
  .feed-item-skeleton__footer {
    flex-direction: column;
  }

  .feed-item-skeleton__actor {
    align-items: flex-start;
  }
}
</style>
