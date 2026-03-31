<template>
  <AppShell>
    <div class="page-container home-page">
      <section class="hero-band" aria-labelledby="home-hero-title">
        <LazyImage
          class="hero-image"
          :src="DEMO_HERO_IMAGES.landing"
          alt=""
          eager
        />
        <div class="hero-overlay" aria-hidden="true" />

        <div class="hero-shell">
          <div class="hero-panel glass-panel" data-onboarding-target="home-hero">
            <p class="eyebrow">Adventure platform</p>
            <h1 id="home-hero-title" class="hero-heading">
              <span>Your Adventures,</span>
              <span>Mapped.</span>
            </h1>
            <p class="hero-description section-copy">
              Discover, plan, and share unforgettable journeys with Atlas.
            </p>

            <div class="hero-actions">
              <RouterLink class="button hero-action hero-action--primary" to="/explore">
                Start Exploring
              </RouterLink>
              <button type="button" class="button hero-action hero-action--secondary" @click="scrollToFeed">
                Watch Demo
              </button>
            </div>

            <button type="button" class="hero-tour-link" @click="startTour">
              <AtlasIcon name="sparkle" label="Start the guided Atlas tour" />
              <span>{{ guidedTourLabel }}</span>
            </button>
          </div>
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
          title="Trending Destinations"
          description="The strongest Atlas signals across food, nature, culture, nightlife, and scenic loops."
        />

        <div v-if="showFeaturedSkeletons" class="spot-grid" role="status" aria-live="polite" aria-label="Loading featured spots">
          <SpotCardSkeleton v-for="index in 4" :key="`featured-skeleton-${index}`" />
        </div>
        <div v-else-if="spotsStore.featuredSpots.length" class="spot-grid stagger-in">
          <SpotCard
            v-for="(spot, index) in spotsStore.featuredSpots"
            :key="spot.id"
            :spot="spot"
            :style="{ '--atlas-stagger-index': index }"
          />
        </div>
        <EmptyStatePanel
          v-else-if="!spotsStore.error"
          eyebrow="Trending now"
          title="Featured spots are waiting on the first pin drop"
          description="Once travelers start surfacing standout places, Atlas will spotlight them here first."
          icon="map"
          heading-level="h3"
        />
      </section>

      <section ref="feedSectionRef" class="section-stack feed-section">
        <SectionHeading
          eyebrow="Network activity"
          title="Activity Feed"
          description="Recent pins, trip moves, and social proof from the people shaping Atlas in real time."
        />

        <div v-if="showFeedSkeletons" class="feed-skeleton-stack" role="status" aria-live="polite" aria-label="Loading Atlas activity feed">
          <FeedItemSkeleton v-for="index in 3" :key="`feed-skeleton-${index}`" />
        </div>
        <VirtualList
          v-else-if="feedStore.items.length"
          class="feed-list"
          :items="feedStore.items"
          :item-height="580"
          :viewport-height="640"
          list-label="Atlas activity feed"
          stagger
        >
          <template #default="{ item }">
            <div class="feed-row">
              <FeedItem :item="item" />
            </div>
          </template>
        </VirtualList>
        <EmptyStatePanel
          v-else-if="!feedStore.error"
          eyebrow="Network activity"
          title="No activity yet"
          description="Once your network starts pinning spots and planning trips, the Atlas feed will fill in here."
          icon="sparkle"
          heading-level="h3"
        />
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import VirtualList from '@/components/common/VirtualList.vue';
import FeedItemSkeleton from '@/components/social/FeedItemSkeleton.vue';
import FeedItem from '@/components/social/FeedItem.vue';
import SpotCard from '@/components/spots/SpotCard.vue';
import SpotCardSkeleton from '@/components/spots/SpotCardSkeleton.vue';
import { useFeedStore } from '@/stores/feed';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSpotsStore } from '@/stores/spots';
import { DEMO_HERO_IMAGES } from '@/utils/demoMedia';
import { useReducedMotion } from '@/utils/motion';

const spotsStore = useSpotsStore();
const feedStore = useFeedStore();
const onboardingStore = useOnboardingStore();
const reducedMotion = useReducedMotion();
const feedSectionRef = ref<HTMLElement | null>(null);
const isBootstrapping = ref(true);
const guidedTourLabel = computed(() => (onboardingStore.hasCompleted ? 'Replay the guided tour' : 'Take the guided tour'));
const loadErrorMessage = computed(() => spotsStore.error || feedStore.error || '');
const showFeaturedSkeletons = computed(() => isBootstrapping.value && !spotsStore.featuredSpots.length && !spotsStore.error);
const showFeedSkeletons = computed(() => isBootstrapping.value && !feedStore.items.length && !feedStore.error);

function scrollToFeed() {
  feedSectionRef.value?.scrollIntoView?.({
    behavior: reducedMotion.value ? 'auto' : 'smooth',
    block: 'start',
  });
}

function startTour() {
  onboardingStore.start();
}

onMounted(async () => {
  onboardingStore.startIfPending();

  try {
    await Promise.allSettled([spotsStore.fetchTrending(), feedStore.fetchFeed()]);
  } finally {
    isBootstrapping.value = false;
  }
});
</script>

<style scoped>
.home-page,
.section-stack,
.feed-skeleton-stack {
  display: grid;
}

.home-page {
  gap: clamp(var(--space-8), 5vw, var(--space-12));
}

.section-stack,
.hero-panel {
  gap: var(--space-6);
}

.feed-skeleton-stack {
  gap: var(--space-4);
  justify-items: center;
}

.feed-list {
  width: 100%;
}

.feed-skeleton-stack :deep(.feed-item-skeleton) {
  width: min(100%, 42.5rem);
}

.hero-band {
  position: relative;
  isolation: isolate;
  display: grid;
  align-items: center;
  min-height: min(80vh, 600px);
  width: 100vw;
  margin-top: calc(var(--shell-content-top) * -1);
  margin-inline: calc(50% - 50vw);
  padding: calc(var(--shell-content-top) + var(--space-6)) var(--shell-side-padding) var(--space-8);
  overflow: hidden;
  background:
    radial-gradient(circle at top center, color-mix(in srgb, var(--accent-teal) 20%, transparent), transparent 40%),
    linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
}

.hero-image,
.hero-overlay {
  position: absolute;
  inset: 0;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-overlay {
  z-index: 1;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 26%, transparent) 0%,
      color-mix(in srgb, var(--bg-primary) 88%, transparent) 100%
    ),
    radial-gradient(circle at top center, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 42%);
}

.hero-shell {
  position: relative;
  z-index: 2;
  width: min(100%, var(--page-max-width));
  margin: 0 auto;
  display: grid;
  place-items: center;
}

.hero-panel,
.error-panel {
  padding: var(--space-6);
}

.hero-panel {
  position: relative;
  width: min(100%, 46rem);
  padding: clamp(var(--space-8), 5vw, var(--space-12));
  text-align: center;
  overflow: hidden;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--glass-border) 100%, transparent),
    0 0 2.5rem color-mix(in srgb, var(--bg-primary) 26%, transparent);
}

.hero-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top center, color-mix(in srgb, var(--text-primary) 12%, transparent), transparent 45%),
    linear-gradient(135deg, color-mix(in srgb, var(--text-primary) 8%, transparent), transparent 42%),
    linear-gradient(320deg, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 40%);
  pointer-events: none;
}

.hero-panel > * {
  position: relative;
  z-index: 1;
}

.eyebrow {
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-eyebrow);
}

.hero-heading,
.error-panel h2,
.error-panel p {
  margin: 0;
}

.hero-heading {
  font-size: var(--font-size-hero);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
  text-shadow: 0 0 2rem color-mix(in srgb, var(--bg-primary) 28%, transparent);
}

.hero-heading span {
  display: block;
}

.hero-description {
  max-width: 34rem;
  margin: 0 auto;
  font-size: clamp(var(--font-size-body), 1.5vw, var(--font-size-h3));
  color: color-mix(in srgb, var(--text-primary) 82%, var(--text-secondary));
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-4);
}

.hero-action {
  min-width: 12rem;
  padding: 0.95rem 1.7rem;
  border-radius: var(--radius-full);
}

.hero-action--primary {
  background: var(--accent-teal);
  color: var(--text-primary);
  box-shadow: var(--shadow-glow-teal);
}

.hero-action--primary:hover,
.hero-action--primary:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow:
    var(--shadow-glow-teal),
    0 0 2rem color-mix(in srgb, var(--accent-teal) 36%, transparent);
}

.hero-action--secondary {
  border-color: color-mix(in srgb, var(--text-primary) 24%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 18%, transparent);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.hero-action--secondary:hover,
.hero-action--secondary:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 50%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--glass-bg));
  box-shadow:
    var(--shadow-md),
    0 0 1.5rem color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.hero-action:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.hero-tour-link {
  justify-self: center;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border: none;
  background: transparent;
  color: color-mix(in srgb, var(--text-primary) 88%, var(--accent-teal));
  padding: 0;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: color var(--transition-fast), transform var(--transition-fast);
}

.hero-tour-link:hover,
.hero-tour-link:focus-visible {
  color: var(--accent-teal);
  transform: translateY(-1px);
}

.hero-tour-link:focus-visible {
  outline: none;
}

.hero-tour-link .atlas-icon {
  font-size: 1rem;
}

.spot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: var(--space-4);
}

.feed-row {
  display: grid;
  width: min(100%, 42.5rem);
  margin: 0 auto;
  padding-bottom: var(--space-4);
}

.feed-section {
  scroll-margin-top: calc(var(--shell-content-top) + var(--space-6));
}

@media (prefers-reduced-motion: no-preference) {
  .hero-panel {
    animation: hero-panel-enter 720ms ease both;
  }

  .hero-heading span {
    opacity: 0;
    transform: translateY(1rem);
    animation: hero-heading-reveal 640ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  .hero-heading span:nth-child(2) {
    animation-delay: 120ms;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-panel,
  .hero-heading span {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .hero-action,
  .hero-action:hover,
  .hero-action:focus-visible,
  .hero-action:active,
  .hero-tour-link,
  .hero-tour-link:hover,
  .hero-tour-link:focus-visible {
    transform: none;
  }
}

@keyframes hero-panel-enter {
  from {
    opacity: 0;
    transform: translateY(var(--space-4)) scale(0.985);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes hero-heading-reveal {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 900px) {
  .hero-band {
    padding-bottom: var(--space-6);
  }

  .hero-panel {
    width: min(100%, 40rem);
  }
}

@media (max-width: 720px) {
  .hero-band {
    padding-top: calc(var(--shell-content-top) + var(--space-4));
    min-height: min(76vh, 38rem);
  }

  .hero-panel {
    padding: var(--space-8) var(--space-6);
  }

  .hero-actions {
    width: 100%;
  }

  .hero-action {
    width: 100%;
  }
}
</style>
