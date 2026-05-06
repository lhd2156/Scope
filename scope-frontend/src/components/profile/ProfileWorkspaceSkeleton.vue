<template>
  <section class="profile-workspace-skeleton" data-test="profile-workspace-skeleton" role="status" aria-live="polite">
    <article class="profile-workspace-skeleton__hero glass-panel">
      <SkeletonBlock width="7.5rem" height="7.5rem" shape="circle" />
      <div class="profile-workspace-skeleton__identity-copy">
        <SkeletonBlock width="7rem" height="0.8rem" />
        <SkeletonBlock width="min(100%, 22rem)" height="3rem" />
        <SkeletonBlock width="10rem" height="1rem" />
        <SkeletonBlock width="min(100%, 34rem)" height="1rem" />
        <SkeletonBlock width="72%" height="1rem" />
      </div>
      <div class="profile-workspace-skeleton__chips">
        <SkeletonBlock v-for="index in 4" :key="`chip-${index}`" width="6rem" height="1.9rem" shape="pill" />
      </div>
      <div class="profile-workspace-skeleton__actions">
        <SkeletonBlock width="10rem" height="2.9rem" shape="pill" />
        <SkeletonBlock width="9.5rem" height="2.9rem" shape="pill" />
      </div>
    </article>

    <div class="profile-workspace-skeleton__stats">
      <article v-for="index in 4" :key="`stat-${index}`" class="glass-panel profile-workspace-skeleton__stat-card">
        <SkeletonBlock width="3.25rem" height="3.25rem" shape="rect" />
        <div class="profile-workspace-skeleton__stat-copy">
          <SkeletonBlock width="4rem" height="1.6rem" />
          <SkeletonBlock width="5.25rem" height="0.85rem" />
        </div>
      </article>
    </div>

    <article class="glass-panel profile-workspace-skeleton__map-panel">
      <div class="profile-workspace-skeleton__section-heading">
        <SkeletonBlock width="7rem" height="0.8rem" />
        <SkeletonBlock width="14rem" height="1.7rem" />
        <SkeletonBlock width="85%" height="0.95rem" />
      </div>
      <div class="profile-workspace-skeleton__map-frame" />
      <div class="profile-workspace-skeleton__map-footer">
        <SkeletonBlock v-for="index in 5" :key="`city-${index}`" width="8rem" height="3.9rem" shape="rect" />
      </div>
    </article>

    <section class="profile-workspace-skeleton__section">
      <div class="profile-workspace-skeleton__section-heading">
        <SkeletonBlock width="8rem" height="0.8rem" />
        <SkeletonBlock width="16rem" height="1.7rem" />
        <SkeletonBlock width="80%" height="0.95rem" />
      </div>
      <div class="profile-workspace-skeleton__adventure-grid">
        <article v-for="index in 3" :key="`trip-${index}`" class="glass-panel profile-workspace-skeleton__adventure-card">
          <div class="profile-workspace-skeleton__adventure-media" />
          <div class="profile-workspace-skeleton__adventure-copy">
            <SkeletonBlock width="7rem" height="0.8rem" />
            <SkeletonBlock width="100%" height="1.5rem" />
            <SkeletonBlock width="84%" height="0.95rem" />
            <SkeletonBlock width="6.5rem" height="2.2rem" shape="pill" />
          </div>
        </article>
      </div>
    </section>

    <section class="profile-workspace-skeleton__section">
      <div class="profile-workspace-skeleton__section-heading">
        <SkeletonBlock width="7rem" height="0.8rem" />
        <SkeletonBlock width="15rem" height="1.7rem" />
        <SkeletonBlock width="76%" height="0.95rem" />
      </div>
      <div class="profile-workspace-skeleton__pin-grid">
        <SpotCardSkeleton v-for="index in 3" :key="`spot-${index}`" />
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import SkeletonBlock from '@/components/common/SkeletonBlock.vue';
import SpotCardSkeleton from '@/components/spots/SpotCardSkeleton.vue';
</script>

<style scoped>
.profile-workspace-skeleton,
.profile-workspace-skeleton__identity-copy,
.profile-workspace-skeleton__section,
.profile-workspace-skeleton__section-heading,
.profile-workspace-skeleton__stat-copy,
.profile-workspace-skeleton__adventure-copy,
.profile-workspace-skeleton__adventure-card {
  display: grid;
  gap: var(--space-5);
}

.profile-workspace-skeleton {
  gap: var(--space-6);
}

.profile-workspace-skeleton__hero,
.profile-workspace-skeleton__map-panel {
  padding: var(--space-6);
}

.profile-workspace-skeleton__hero {
  justify-items: center;
  text-align: center;
}

.profile-workspace-skeleton__identity-copy {
  width: 100%;
  justify-items: center;
}

.profile-workspace-skeleton__chips,
.profile-workspace-skeleton__actions,
.profile-workspace-skeleton__map-footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.profile-workspace-skeleton__chips,
.profile-workspace-skeleton__actions {
  justify-content: center;
}

.profile-workspace-skeleton__stats,
.profile-workspace-skeleton__adventure-grid,
.profile-workspace-skeleton__pin-grid {
  display: grid;
  gap: var(--space-4);
}

.profile-workspace-skeleton__stats {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.profile-workspace-skeleton__stat-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-5);
}

.profile-workspace-skeleton__map-panel,
.profile-workspace-skeleton__section-heading,
.profile-workspace-skeleton__adventure-copy {
  gap: var(--space-4);
}

.profile-workspace-skeleton__map-panel {
  display: grid;
}

.profile-workspace-skeleton__map-frame,
.profile-workspace-skeleton__adventure-media {
  border-radius: var(--radius-2xl);
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 34%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
  border: 1px solid var(--glass-border);
}

.profile-workspace-skeleton__map-frame {
  min-height: 26rem;
}

.profile-workspace-skeleton__map-footer {
  margin-top: var(--space-4);
}

.profile-workspace-skeleton__adventure-grid,
.profile-workspace-skeleton__pin-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.profile-workspace-skeleton__adventure-card {
  overflow: hidden;
  gap: 0;
}

.profile-workspace-skeleton__adventure-media {
  aspect-ratio: 16 / 10;
}

.profile-workspace-skeleton__adventure-copy {
  padding: var(--space-5);
}

@media (max-width: 980px) {
  .profile-workspace-skeleton__stats,
  .profile-workspace-skeleton__adventure-grid,
  .profile-workspace-skeleton__pin-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .profile-workspace-skeleton__hero,
  .profile-workspace-skeleton__map-panel {
    padding: var(--space-5);
  }

  .profile-workspace-skeleton__stats,
  .profile-workspace-skeleton__adventure-grid,
  .profile-workspace-skeleton__pin-grid {
    grid-template-columns: 1fr;
  }

  .profile-workspace-skeleton__actions :deep(.skeleton-block) {
    width: 100%;
  }
}
</style>
