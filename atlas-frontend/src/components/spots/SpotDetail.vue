<template>
  <section v-if="spot" class="spot-detail page-stack">
    <div class="glass-panel hero-panel">
      <img :src="spot.photoUrl" :alt="spot.title" class="hero-image" />
      <div class="hero-copy">
        <span class="badge" :class="`badge-${spot.category}`">{{ spot.category }}</span>
        <h1>{{ spot.title }}</h1>
        <p class="hero-meta">{{ spot.address }} · {{ spot.city }}, {{ spot.country }}</p>
        <p class="hero-description">{{ spot.description }}</p>
      </div>
    </div>

    <div class="content-grid">
      <section class="glass-panel panel-section">
        <h2>Gallery</h2>
        <div class="gallery-grid">
          <img v-for="photo in spot.photos" :key="photo.id" :src="photo.url" :alt="photo.caption ?? spot.title" />
        </div>
      </section>

      <section class="glass-panel panel-section">
        <h2>Reviews</h2>
        <article v-for="review in spot.reviews" :key="review.id" class="review-card">
          <div class="review-header">
            <strong>{{ review.user.displayName }}</strong>
            <span>★ {{ review.rating.toFixed(1) }}</span>
          </div>
          <p>{{ review.comment }}</p>
        </article>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { SpotDetail as SpotDetailModel } from '@/types';

defineProps<{
  spot: SpotDetailModel | null;
}>();
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: var(--space-6);
}

.hero-panel {
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
}

.hero-image {
  width: 100%;
  height: 100%;
  min-height: 22rem;
  object-fit: cover;
}

.hero-copy {
  padding: var(--space-8);
  display: grid;
  gap: var(--space-4);
}

.hero-copy h1,
.panel-section h2 {
  margin: 0;
}

.hero-meta,
.hero-description,
.review-card p {
  color: var(--text-secondary);
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-6);
}

.panel-section {
  padding: var(--space-6);
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.gallery-grid img {
  width: 100%;
  border-radius: var(--radius-lg);
  min-height: 10rem;
  object-fit: cover;
}

.review-card + .review-card {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

.review-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

@media (max-width: 900px) {
  .hero-panel,
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
