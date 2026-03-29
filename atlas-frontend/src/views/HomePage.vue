<template>
  <AppShell>
    <div class="page-container page-stack">
      <section class="glass-panel hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Adventure platform</p>
          <h1>Atlas turns every outing into a mapped story worth sharing.</h1>
          <p class="section-copy">
            Document premium spots, plan collaborative trips, and let the intelligence layer build routes from the best community pins.
          </p>
          <div class="hero-actions">
            <RouterLink class="button button-primary" to="/explore">Explore the map</RouterLink>
            <RouterLink class="button button-secondary" to="/trips/new">Plan a trip</RouterLink>
            <RouterLink class="button button-secondary" to="/friends">View your network</RouterLink>
          </div>
        </div>
        <img src="@/assets/hero.png" alt="Atlas hero" class="hero-art" />
      </section>

      <article v-if="loadErrorMessage" class="glass-panel error-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Part of the Atlas home feed could not be loaded</h2>
        <p class="section-copy">{{ loadErrorMessage }}</p>
      </article>

      <section>
        <SectionHeading
          eyebrow="Trending now"
          title="Community-loved spots"
          description="The strongest Atlas signals across food, nature, culture, nightlife, and scenic loops."
        />
        <div class="card-grid">
          <SpotCard v-for="spot in spotsStore.featuredSpots" :key="spot.id" :spot="spot" />
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Social graph"
          title="Recent activity from the network"
          description="Feed items wire together the content engine and social layer so trip planning feels alive."
        />
        <p v-if="feedStore.loading" class="section-copy">Loading recent network activity...</p>
        <div v-else class="feed-list">
          <FeedItem v-for="item in feedStore.items" :key="item.id" :item="item" />
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import FeedItem from '@/components/social/FeedItem.vue';
import SpotCard from '@/components/spots/SpotCard.vue';
import { useFeedStore } from '@/stores/feed';
import { useSpotsStore } from '@/stores/spots';

const spotsStore = useSpotsStore();
const feedStore = useFeedStore();
const loadErrorMessage = computed(() => spotsStore.error || feedStore.error || '');

onMounted(async () => {
  await Promise.allSettled([spotsStore.fetchTrending(), feedStore.fetchFeed()]);
});
</script>

<style scoped>
.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  align-items: center;
  overflow: hidden;
}

.hero-copy {
  padding: var(--space-10);
}

.eyebrow {
  margin: 0 0 var(--space-3);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: var(--font-size-caption);
}

h1 {
  margin: 0;
  font-size: var(--font-size-hero);
  line-height: var(--line-height-tight);
}

.hero-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-6);
  flex-wrap: wrap;
}

.hero-art {
  width: 100%;
  height: 100%;
  min-height: 24rem;
  object-fit: cover;
}

.error-panel,
.feed-list {
  display: grid;
  gap: var(--space-4);
}

.error-panel {
  padding: var(--space-6);
}

.error-panel h2,
.error-panel p {
  margin: 0;
}

@media (max-width: 960px) {
  .hero-panel {
    grid-template-columns: 1fr;
  }
}
</style>
