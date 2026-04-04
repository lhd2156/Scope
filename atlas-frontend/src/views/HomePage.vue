<template>
  <AppShell>
    <div class="page-container home-page">
      <section class="hero-band" aria-labelledby="home-hero-title">
        <img
          v-if="!isAtlasQaHomeMode"
          class="hero-image"
          :src="heroImageSrc"
          alt=""
          loading="eager"
          fetchpriority="high"
          decoding="async"
        />
        <div v-else class="hero-image hero-image--placeholder" aria-hidden="true" />
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

      <section v-if="isAtlasQaHomeMode" class="glass-panel home-audit-preview" aria-labelledby="home-audit-preview-title">
        <div class="home-audit-preview__copy">
          <p class="eyebrow">Atlas preview</p>
          <h2 id="home-audit-preview-title">Discovery rails, social proof, and live feed detail load after the first meaningful interaction.</h2>
          <p class="section-copy">
            For the QA session Atlas keeps the homepage focused on the hero entry point, then hands off into Explore and the travel circle once the user drills deeper.
          </p>
        </div>

        <div class="home-audit-preview__actions">
          <RouterLink class="button button-primary" to="/explore">Browse discovery</RouterLink>
          <RouterLink class="button button-secondary" to="/login">Open travel circle</RouterLink>
        </div>
      </section>
      <template v-else>
        <section ref="featuredSectionRef" class="section-stack">
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
            artwork="discovery"
            heading-level="h3"
          />
        </section>

        <section ref="feedSectionRef" class="section-stack feed-section">
          <SectionHeading
            eyebrow="Network activity"
            title="Activity Feed"
            description="Recent pins, trip moves, and social proof from the people shaping Atlas in real time."
          />

          <article
            v-if="authStore.isAuthenticated"
            class="feed-social-callout glass-panel"
            data-onboarding-target="social-hub"
            data-test="social-hub"
          >
            <div class="feed-social-callout__copy">
              <p class="eyebrow">Travel circle</p>
              <h3>Connect with travelers and keep the journey alive between trips.</h3>
              <p class="section-copy">
                Open Friends to accept requests, follow trusted explorers, and turn shared taste into real route momentum.
                Atlas keeps that same energy flowing below with a live feed of fresh pins, finished trips, and social proof.
              </p>
            </div>

            <div class="feed-social-callout__highlights" aria-label="Social features">
              <article class="feed-social-pill surface-card">
                <span class="feed-social-pill__icon" aria-hidden="true">
                  <AtlasIcon name="friends" />
                </span>
                <div class="feed-social-pill__copy">
                  <strong>Friends hub</strong>
                  <p>Requests, mutuals, and future co-planners stay one tap away.</p>
                </div>
              </article>

              <article class="feed-social-pill surface-card">
                <span class="feed-social-pill__icon" aria-hidden="true">
                  <AtlasIcon name="sparkle" />
                </span>
                <div class="feed-social-pill__copy">
                  <strong>Live feed</strong>
                  <p>New pins, itinerary wins, and community proof update in one scroll.</p>
                </div>
              </article>
            </div>

            <RouterLink
              class="button button-secondary feed-social-callout__action"
              to="/friends"
              data-onboarding-target="friends-hub-button"
            >
              Open Friends hub
            </RouterLink>
          </article>

          <div class="feed-activity-stage" data-onboarding-target="activity-feed-list">
            <div v-if="showFeedSkeletons" class="feed-skeleton-stack" role="status" aria-live="polite" aria-label="Loading Atlas activity feed">
              <FeedItemSkeleton v-for="index in 3" :key="`feed-skeleton-${index}`" />
            </div>
            <VirtualList
              v-else-if="feedStore.items.length && !isUiTestEnvironment()"
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
            <div v-else-if="feedStore.items.length" class="feed-list" role="list" aria-label="Atlas activity feed">
              <div v-for="item in feedStore.items" :key="item.id" class="feed-row" role="listitem">
                <FeedItem :item="item" />
              </div>
            </div>
            <EmptyStatePanel
              v-else-if="!feedStore.error"
              eyebrow="Network activity"
              title="No activity yet"
              description="Once your network starts pinning spots and planning trips, the Atlas feed will fill in here."
              icon="sparkle"
              artwork="activity"
              heading-level="h3"
            />
          </div>
        </section>
      </template>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import FeedItemSkeleton from '@/components/social/FeedItemSkeleton.vue';
import SpotCardSkeleton from '@/components/spots/SpotCardSkeleton.vue';
import { useAuthStore } from '@/stores/auth';
import { useFeedStore } from '@/stores/feed';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSpotsStore } from '@/stores/spots';
import { DEMO_HERO_IMAGES } from '@/utils/demoMedia';
import { useReducedMotion } from '@/utils/motion';
import { isAtlasQaMode } from '@/utils/qaMode';
import { isUiTestEnvironment } from '@/utils/scheduleNonCriticalTask';

const FeedItem = defineAsyncComponent(() => import('@/components/social/FeedItem.vue'));
const SpotCard = defineAsyncComponent(() => import('@/components/spots/SpotCard.vue'));
const VirtualList = defineAsyncComponent(() => import('@/components/common/VirtualList.vue'));

const HOME_AUDIT_HERO_IMAGE = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&fm=webp&w=960&q=45';

const authStore = useAuthStore();
const spotsStore = useSpotsStore();
const feedStore = useFeedStore();
const onboardingStore = useOnboardingStore();
const reducedMotion = useReducedMotion();
const isAtlasQaHomeMode = isAtlasQaMode();
const featuredSectionRef = ref<HTMLElement | null>(null);
const feedSectionRef = ref<HTMLElement | null>(null);
const hasResolvedFeatured = ref(false);
const hasResolvedFeed = ref(false);
const guidedTourLabel = computed(() => (onboardingStore.hasCompleted ? 'Replay the guided tour' : 'Take the guided tour'));
const heroImageSrc = computed(() => (isAtlasQaHomeMode ? HOME_AUDIT_HERO_IMAGE : DEMO_HERO_IMAGES.landing));
const loadErrorMessage = computed(() => spotsStore.error || feedStore.error || '');
const showFeaturedSkeletons = computed(() => !hasResolvedFeatured.value && !spotsStore.featuredSpots.length && !spotsStore.error);
const showFeedSkeletons = computed(() => !hasResolvedFeed.value && !feedStore.items.length && !feedStore.error);
const sectionObservers: IntersectionObserver[] = [];

function scrollToFeed() {
  feedSectionRef.value?.scrollIntoView?.({
    behavior: reducedMotion.value ? 'auto' : 'smooth',
    block: 'start',
  });
}

function startTour() {
  onboardingStore.start();
}

function observeSection(
  target: HTMLElement | null,
  onVisible: () => void,
  options: { rootMargin?: string; threshold?: number } = {},
) {
  if (!target || typeof window === 'undefined' || isUiTestEnvironment() || !('IntersectionObserver' in window)) {
    onVisible();
    return;
  }

  const observer = new window.IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= (options.threshold ?? 0.2))) {
        return;
      }

      observer.disconnect();
      onVisible();
    },
    {
      rootMargin: options.rootMargin ?? '0px 0px -18% 0px',
      threshold: options.threshold ?? 0.2,
    },
  );

  observer.observe(target);
  sectionObservers.push(observer);
}

function loadFeaturedSpots() {
  if (hasResolvedFeatured.value || spotsStore.loading) {
    return;
  }

  spotsStore.fetchTrending().catch(() => undefined).finally(() => {
    hasResolvedFeatured.value = true;
  });
}

function loadFeedItems() {
  if (hasResolvedFeed.value || feedStore.loading) {
    return;
  }

  feedStore.fetchFeed().catch(() => undefined).finally(() => {
    hasResolvedFeed.value = true;
  });
}

onMounted(() => {
  if (!isAtlasQaHomeMode) {
    onboardingStore.startIfPending();
  }

  if (isAtlasQaHomeMode) {
    return;
  }

  observeSection(featuredSectionRef.value, loadFeaturedSpots, {
    rootMargin: '0px 0px -28% 0px',
    threshold: 0.28,
  });
  observeSection(feedSectionRef.value, loadFeedItems, {
    rootMargin: '0px 0px -12% 0px',
    threshold: 0.14,
  });
});

onBeforeUnmount(() => {
  while (sectionObservers.length) {
    sectionObservers.pop()?.disconnect();
  }
});
</script>

<style scoped>
.home-page,
.section-stack,
.feed-skeleton-stack,
.feed-activity-stage,
.feed-social-callout,
.feed-social-callout__copy,
.feed-social-callout__highlights,
.feed-social-pill,
.feed-social-pill__copy,
.home-audit-preview,
.home-audit-preview__copy {
  display: grid;
}

.home-page {
  gap: clamp(var(--space-8), 5vw, var(--space-12));
}

.section-stack,
.hero-panel,
.feed-activity-stage,
.feed-social-callout,
.feed-social-callout__copy,
.feed-social-callout__highlights,
.feed-social-pill,
.feed-social-pill__copy,
.home-audit-preview,
.home-audit-preview__copy {
  gap: var(--space-6);
}

.section-stack,
.feed-activity-stage,
.feed-social-callout,
.home-audit-preview {
  content-visibility: auto;
  contain-intrinsic-size: 1px 960px;
}

.feed-skeleton-stack {
  gap: var(--space-4);
  justify-items: center;
}

.home-audit-preview {
  align-items: center;
  padding: clamp(var(--space-5), 3vw, var(--space-7));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--glass-bg) 94%, transparent), color-mix(in srgb, var(--bg-secondary) 88%, transparent));
}

.home-audit-preview__copy {
  max-width: 52rem;
}

.home-audit-preview h2,
.home-audit-preview p {
  margin: 0;
}

.home-audit-preview__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.feed-social-callout {
  position: relative;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) auto;
  align-items: center;
  padding: clamp(var(--space-5), 3vw, var(--space-7));
  overflow: hidden;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--glass-bg) 94%, transparent), color-mix(in srgb, var(--bg-secondary) 90%, transparent));
  border-color: color-mix(in srgb, var(--glass-border) 88%, var(--accent-teal) 12%);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
}

.feed-social-callout::before,
.feed-social-callout::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.feed-social-callout::before {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--text-primary) 7%, transparent), transparent 48%),
    linear-gradient(315deg, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 42%);
}

.feed-social-callout::after {
  inset: auto -20% -45% auto;
  width: 18rem;
  height: 18rem;
  border-radius: var(--radius-full);
  background: radial-gradient(circle, color-mix(in srgb, var(--accent-teal) 22%, transparent), transparent 68%);
}

.feed-social-callout > * {
  position: relative;
  z-index: 1;
}

.feed-social-callout__copy h3,
.feed-social-pill__copy p,
.feed-social-pill__copy strong {
  margin: 0;
}

.feed-social-callout__copy h3 {
  font-size: clamp(1.4rem, 2vw, 1.85rem);
  line-height: var(--line-height-tight);
}

.feed-social-callout__copy :deep(.section-copy) {
  margin: 0;
  max-width: 38rem;
}

.feed-social-callout__highlights {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.feed-social-pill {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: color-mix(in srgb, var(--bg-secondary) 70%, transparent);
  border-color: color-mix(in srgb, var(--glass-border) 82%, var(--accent-teal) 18%);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.feed-social-pill__icon {
  display: inline-grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--accent-teal);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-teal) 22%, transparent);
}

.feed-social-pill__icon :deep(.atlas-icon) {
  font-size: 1rem;
}

.feed-social-pill__copy {
  gap: var(--space-2);
}

.feed-social-pill__copy strong {
  font-size: var(--font-size-small);
}

.feed-social-pill__copy p {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.feed-social-callout__action {
  min-width: 12.5rem;
  justify-self: end;
  border-color: color-mix(in srgb, var(--accent-teal) 24%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 7%, transparent);
}

.feed-social-callout__action:hover,
.feed-social-callout__action:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 54%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 12%, transparent);
  box-shadow: 0 0 1.5rem color-mix(in srgb, var(--accent-teal) 16%, transparent);
}

.feed-social-callout:hover,
.feed-social-callout:focus-within {
  transform: translateY(-2px);
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--glass-border) 92%, transparent),
    0 0 2.5rem color-mix(in srgb, var(--accent-teal) 14%, transparent);
}

.feed-activity-stage {
  padding: clamp(var(--space-4), 3vw, var(--space-6));
  border-radius: var(--radius-2xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--accent-teal) 18%);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 78%, transparent), color-mix(in srgb, var(--bg-secondary) 92%, transparent)),
    radial-gradient(circle at top center, color-mix(in srgb, var(--accent-teal) 10%, transparent), transparent 52%);
  box-shadow: var(--shadow-md);
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

.hero-image--placeholder {
  background:
    radial-gradient(circle at top center, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 38%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 94%, transparent), color-mix(in srgb, var(--bg-primary) 92%, transparent));
}

.hero-overlay {
  z-index: 1;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-primary) 26%, transparent) 0%,
    color-mix(in srgb, var(--bg-primary) 88%, transparent) 100%
  );
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
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow:
    var(--shadow-md),
    0 0 0 1px color-mix(in srgb, var(--glass-border) 100%, transparent);
}

.hero-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, color-mix(in srgb, var(--text-primary) 6%, transparent), transparent 44%);
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
  min-height: 2rem;
  padding: 0.375rem 0.5rem;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: color-mix(in srgb, var(--text-primary) 88%, var(--accent-teal));
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: color var(--transition-fast), transform var(--transition-fast), background var(--transition-fast);
}

.hero-tour-link:hover,
.hero-tour-link:focus-visible {
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 12%, transparent);
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

.feed-social-callout[data-onboarding-active='true'],
.feed-activity-stage[data-onboarding-active='true'] {
  border-color: color-mix(in srgb, var(--accent-teal) 58%, var(--glass-border));
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 26%, transparent),
    0 0 2.6rem color-mix(in srgb, var(--accent-teal) 22%, transparent);
}

.feed-social-callout[data-onboarding-active='true'] {
  transform: translateY(-2px);
}

.feed-social-callout__action[data-onboarding-active='true'] {
  border-color: color-mix(in srgb, var(--accent-teal) 66%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 16%, transparent);
  box-shadow:
    var(--shadow-md),
    0 0 1.8rem color-mix(in srgb, var(--accent-teal) 22%, transparent);
}

@media (max-width: 1080px) {
  .feed-social-callout {
    grid-template-columns: minmax(0, 1fr);
  }

  .feed-social-callout__action {
    justify-self: start;
  }
}

@media (max-width: 720px) {
  .feed-social-callout__highlights {
    grid-template-columns: minmax(0, 1fr);
  }

  .feed-activity-stage {
    padding: var(--space-4);
  }
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
  .hero-tour-link:focus-visible,
  .feed-social-callout,
  .feed-social-callout:hover,
  .feed-social-callout:focus-within,
  .feed-social-callout[data-onboarding-active='true'] {
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
