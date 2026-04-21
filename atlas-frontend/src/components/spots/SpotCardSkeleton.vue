<template>
  <article class="spot-card-skeleton glass-panel" aria-hidden="true" data-test="spot-card-skeleton">
    <div class="spot-card-skeleton__media">
      <div class="spot-card-skeleton__overlay">
        <SkeletonBlock width="6.25rem" height="1.75rem" shape="pill" tone="soft" />
        <SkeletonBlock width="4.5rem" height="1.75rem" shape="pill" tone="soft" />
      </div>
    </div>

    <div class="spot-card-skeleton__body">
      <div class="spot-card-skeleton__row">
        <SkeletonBlock width="7rem" height="0.85rem" />
        <SkeletonBlock width="5rem" height="1.55rem" shape="pill" />
      </div>

      <div class="spot-card-skeleton__row spot-card-skeleton__row--title">
        <SkeletonBlock width="70%" height="1.4rem" />
        <SkeletonBlock width="4.5rem" height="1.55rem" shape="pill" />
      </div>

      <div class="spot-card-skeleton__copy">
        <SkeletonBlock width="100%" height="0.95rem" />
        <SkeletonBlock width="92%" height="0.95rem" />
        <SkeletonBlock width="68%" height="0.95rem" />
      </div>

      <div class="spot-card-skeleton__row spot-card-skeleton__row--footer">
        <SkeletonBlock width="8rem" height="0.85rem" />
        <SkeletonBlock width="5.5rem" height="0.95rem" />
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import SkeletonBlock from '@/components/common/SkeletonBlock.vue';
</script>

<style scoped>
.spot-card-skeleton {
  overflow: hidden;
  display: grid;
  grid-template-rows: 15rem 1fr;
}

.spot-card-skeleton__media {
  position: relative;
  min-height: 15rem;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 35%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.spot-card-skeleton__overlay,
.spot-card-skeleton__row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}

.spot-card-skeleton__overlay {
  padding: var(--space-4);
}

.spot-card-skeleton__body,
.spot-card-skeleton__copy {
  display: grid;
  gap: var(--space-4);
}

.spot-card-skeleton__body {
  padding: var(--space-5);
}

.spot-card-skeleton__row {
  align-items: center;
}

.spot-card-skeleton__row--title,
.spot-card-skeleton__row--footer {
  align-items: flex-start;
}

@media (max-width: 720px) {
  .spot-card-skeleton {
    grid-template-rows: 13rem 1fr;
  }

  .spot-card-skeleton__overlay,
  .spot-card-skeleton__row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
