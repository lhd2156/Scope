<template>
  <article class="feed-item glass-panel">
    <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" />
    <div class="copy">
      <p class="meta">{{ item.actor.displayName }} · {{ item.type }}</p>
      <h3>{{ item.title }}</h3>
      <p>{{ item.excerpt }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { FeedItem as FeedItemModel } from '@/types';

defineProps<{
  item: FeedItemModel;
}>();
</script>

<style scoped>
.feed-item {
  overflow: hidden;
  display: grid;
  grid-template-columns: 10rem 1fr;
}

img {
  width: 100%;
  height: 100%;
  min-height: 10rem;
  object-fit: cover;
}

.copy {
  padding: var(--space-5);
}

.meta,
.copy p {
  color: var(--text-secondary);
}

h3,
.copy p,
.meta {
  margin: 0 0 var(--space-3);
}

@media (max-width: 768px) {
  .feed-item {
    grid-template-columns: 1fr;
  }
}
</style>
