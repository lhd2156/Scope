<template>
  <AppShell>
    <div class="page-container home-page">
      <section class="glass-panel hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Atlas</p>
          <h1>Atlas turns every outing into a mapped story worth sharing.</h1>
          <p class="section-copy">
            Discover community-loved stops, build smarter itineraries, and keep up with the latest adventure signals from your network.
          </p>
        </div>
      </section>

      <article v-if="loadErrorMessage" class="glass-panel error-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Part of the Atlas home feed could not be loaded</h2>
        <p class="section-copy">{{ loadErrorMessage }}</p>
      </article>

      <section class="section-stack">
        <SectionHeading
          eyebrow="Trending now"
          title="Community-loved spots"
          description="The strongest Atlas signals across food, nature, culture, nightlife, and scenic loops."
        />

        <div class="spot-grid">
          <SpotCard v-for="spot in spotsStore.featuredSpots" :key="spot.id" :spot="spot" />
        </div>
      </section>

      <section class="section-stack">
        <SectionHeading
          eyebrow="Network activity"
          title="What your community is doing now"
          description="Recent pins, trip moves, and social proof from the people shaping Atlas in real time."
        />

        <VirtualList
          v-if="feedStore.items.length"
          :items="feedStore.items"
          :item-height="232"
          :viewport-height="560"
          list-label="Atlas activity feed"
        >
          <template #default="{ item }">
            <div class="feed-row">
              <FeedItem :item="item" />
            </div>
          </template>
        </VirtualList>
        <div v-else class="glass-panel empty-panel">
          <strong>No activity yet</strong>
          <p>Once your network starts pinning spots and planning trips, the Atlas feed will fill in here.</p>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import VirtualList from '@/components/common/VirtualList.vue';
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
.home-page,
.section-stack {
  display: grid;
  gap: var(--space-6);
}

.hero-panel,
.error-panel,
.empty-panel {
  padding: var(--space-6);
}

.hero-copy,
.feed-row {
  display: grid;
  gap: var(--space-4);
}

.hero-copy h1,
.error-panel h2,
.error-panel p,
.empty-panel strong,
.empty-panel p {
  margin: 0;
}

.eyebrow {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.spot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: var(--space-4);
}

.feed-row {
  padding-bottom: var(--space-4);
}

.empty-panel p {
  color: var(--text-secondary);
}
</style>
