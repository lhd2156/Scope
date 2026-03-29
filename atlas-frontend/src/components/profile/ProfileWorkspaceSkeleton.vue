<template>
  <section class="profile-workspace-skeleton" data-test="profile-workspace-skeleton" role="status" aria-live="polite">
    <article class="profile-workspace-skeleton__hero glass-panel">
      <div class="profile-workspace-skeleton__identity">
        <SkeletonBlock width="5.5rem" height="5.5rem" shape="circle" />

        <div class="profile-workspace-skeleton__identity-copy">
          <SkeletonBlock width="7rem" height="0.8rem" />
          <SkeletonBlock width="min(100%, 18rem)" height="2.4rem" />
          <SkeletonBlock width="12rem" height="1rem" />
          <SkeletonBlock width="100%" height="0.95rem" />
          <SkeletonBlock width="84%" height="0.95rem" />

          <div class="profile-workspace-skeleton__chips">
            <SkeletonBlock v-for="index in 3" :key="`chip-${index}`" width="5.75rem" height="1.75rem" shape="pill" />
          </div>
        </div>

        <div class="profile-workspace-skeleton__actions">
          <SkeletonBlock width="9rem" height="2.8rem" shape="pill" />
          <SkeletonBlock width="8.5rem" height="2.8rem" shape="pill" />
        </div>
      </div>

      <div class="profile-workspace-skeleton__summary-grid">
        <article v-for="index in 3" :key="`summary-${index}`" class="surface-card profile-workspace-skeleton__summary-card">
          <SkeletonBlock width="6rem" height="0.85rem" />
          <SkeletonBlock width="4.5rem" height="1.8rem" />
          <SkeletonBlock width="8rem" height="0.85rem" />
        </article>
      </div>
    </article>

    <div class="profile-workspace-skeleton__grid">
      <div class="profile-workspace-skeleton__main">
        <article class="glass-panel profile-workspace-skeleton__panel profile-workspace-skeleton__map-panel">
          <div class="profile-workspace-skeleton__section-heading">
            <SkeletonBlock width="7rem" height="0.8rem" />
            <SkeletonBlock width="16rem" height="1.7rem" />
            <SkeletonBlock width="90%" height="0.95rem" />
          </div>
          <div class="profile-workspace-skeleton__map-frame" />
        </article>

        <section class="profile-workspace-skeleton__section">
          <div class="profile-workspace-skeleton__section-heading">
            <SkeletonBlock width="6rem" height="0.8rem" />
            <SkeletonBlock width="14rem" height="1.6rem" />
            <SkeletonBlock width="88%" height="0.95rem" />
          </div>
          <div class="card-grid">
            <SpotCardSkeleton v-for="index in 2" :key="`spot-${index}`" />
          </div>
        </section>

        <section class="profile-workspace-skeleton__section">
          <div class="profile-workspace-skeleton__section-heading">
            <SkeletonBlock width="5rem" height="0.8rem" />
            <SkeletonBlock width="13rem" height="1.6rem" />
            <SkeletonBlock width="78%" height="0.95rem" />
          </div>
          <div class="profile-workspace-skeleton__trip-grid">
            <article v-for="index in 2" :key="`trip-${index}`" class="surface-card profile-workspace-skeleton__trip-card">
              <SkeletonBlock width="7rem" height="0.8rem" />
              <SkeletonBlock width="72%" height="1.45rem" />
              <SkeletonBlock width="60%" height="0.95rem" />
              <div class="profile-workspace-skeleton__trip-meta">
                <SkeletonBlock width="4.5rem" height="1.65rem" shape="pill" />
                <SkeletonBlock width="5rem" height="1.65rem" shape="pill" />
                <SkeletonBlock width="4rem" height="1.65rem" shape="pill" />
              </div>
            </article>
          </div>
        </section>
      </div>

      <aside class="profile-workspace-skeleton__side">
        <article class="surface-card profile-workspace-skeleton__panel profile-workspace-skeleton__stats-panel">
          <div class="profile-workspace-skeleton__section-heading profile-workspace-skeleton__section-heading--compact">
            <SkeletonBlock width="8rem" height="1.3rem" />
            <SkeletonBlock width="72%" height="0.95rem" />
          </div>
          <div class="profile-workspace-skeleton__stat-grid">
            <article v-for="index in 4" :key="`stat-${index}`" class="profile-workspace-skeleton__stat-card">
              <SkeletonBlock width="4rem" height="1.6rem" />
              <SkeletonBlock width="5.5rem" height="0.85rem" />
            </article>
          </div>
        </article>

        <article class="glass-panel profile-workspace-skeleton__panel">
          <div class="profile-workspace-skeleton__section-heading profile-workspace-skeleton__section-heading--compact">
            <SkeletonBlock width="7rem" height="0.8rem" />
            <SkeletonBlock width="10rem" height="1.5rem" />
            <SkeletonBlock width="100%" height="0.95rem" />
            <SkeletonBlock width="86%" height="0.95rem" />
          </div>
          <div class="profile-workspace-skeleton__insight-list">
            <article v-for="index in 2" :key="`insight-${index}`" class="surface-card profile-workspace-skeleton__insight-card">
              <SkeletonBlock width="6rem" height="0.8rem" />
              <SkeletonBlock width="70%" height="1.25rem" />
              <SkeletonBlock width="8rem" height="0.85rem" />
            </article>
          </div>
          <div class="profile-workspace-skeleton__chips">
            <SkeletonBlock v-for="index in 4" :key="`interest-${index}`" width="5.25rem" height="1.7rem" shape="pill" />
          </div>
        </article>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import SkeletonBlock from '@/components/common/SkeletonBlock.vue';
import SpotCardSkeleton from '@/components/spots/SpotCardSkeleton.vue';
</script>

<style scoped>
.profile-workspace-skeleton,
.profile-workspace-skeleton__identity-copy,
.profile-workspace-skeleton__section-heading,
.profile-workspace-skeleton__trip-card,
.profile-workspace-skeleton__side,
.profile-workspace-skeleton__main,
.profile-workspace-skeleton__section,
.profile-workspace-skeleton__insight-list {
  display: grid;
  gap: var(--space-5);
}

.profile-workspace-skeleton {
  gap: var(--space-6);
}

.profile-workspace-skeleton__hero,
.profile-workspace-skeleton__panel {
  padding: var(--space-6);
}

.profile-workspace-skeleton__identity,
.profile-workspace-skeleton__actions,
.profile-workspace-skeleton__chips,
.profile-workspace-skeleton__trip-meta {
  display: flex;
  gap: var(--space-4);
}

.profile-workspace-skeleton__identity {
  justify-content: space-between;
  align-items: flex-start;
}

.profile-workspace-skeleton__identity-copy {
  flex: 1;
}

.profile-workspace-skeleton__actions,
.profile-workspace-skeleton__chips,
.profile-workspace-skeleton__trip-meta {
  flex-wrap: wrap;
}

.profile-workspace-skeleton__summary-grid,
.profile-workspace-skeleton__grid,
.profile-workspace-skeleton__stat-grid {
  display: grid;
  gap: var(--space-4);
}

.profile-workspace-skeleton__summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: var(--space-6);
}

.profile-workspace-skeleton__summary-card,
.profile-workspace-skeleton__trip-card,
.profile-workspace-skeleton__insight-card,
.profile-workspace-skeleton__stat-card {
  padding: var(--space-4);
}

.profile-workspace-skeleton__grid {
  grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.8fr);
}

.profile-workspace-skeleton__map-frame {
  min-height: 18rem;
  border-radius: var(--radius-xl);
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 30%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
  border: 1px solid var(--glass-border);
}

.profile-workspace-skeleton__trip-grid {
  display: grid;
  gap: var(--space-4);
}

.profile-workspace-skeleton__stats-panel {
  display: grid;
  gap: var(--space-5);
}

.profile-workspace-skeleton__stat-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.profile-workspace-skeleton__stat-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  display: grid;
  gap: var(--space-2);
}

.profile-workspace-skeleton__insight-card {
  display: grid;
  gap: var(--space-2);
}

.profile-workspace-skeleton__section-heading--compact {
  gap: var(--space-3);
}

@media (max-width: 1120px) {
  .profile-workspace-skeleton__grid,
  .profile-workspace-skeleton__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .profile-workspace-skeleton__identity {
    flex-direction: column;
  }

  .profile-workspace-skeleton__actions {
    width: 100%;
  }

  .profile-workspace-skeleton__actions :deep(.skeleton-block) {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .profile-workspace-skeleton__hero,
  .profile-workspace-skeleton__panel {
    padding: var(--space-5);
  }

  .profile-workspace-skeleton__stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
