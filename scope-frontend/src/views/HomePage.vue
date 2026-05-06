<template>
  <AppShell>
    <div class="page-container home-page">
      <section class="hero-band" aria-labelledby="home-hero-title">
        <img
          class="hero-band__image"
          :src="DEMO_HERO_IMAGES.landing"
          alt=""
          aria-hidden="true"
          fetchpriority="high"
        />
        <div class="hero-shell">
          <div class="hero-panel" data-onboarding-target="home-hero">
            <h1 id="home-hero-title" class="hero-heading">
              Find a place worth going.
            </h1>
            <p class="hero-description section-copy">
              Save the spots you trust, see what people are sharing, and build the route from there.
            </p>

            <div class="hero-actions">
              <RouterLink class="button hero-action hero-action--primary" to="/explore">
                Explore spots
              </RouterLink>
              <button type="button" class="button hero-action hero-action--secondary" @click="scrollToFeed">
                See activity
              </button>
            </div>

            <button type="button" class="hero-tour-link" @click="startTour">
              {{ guidedTourLabel }}
            </button>
          </div>
        </div>
      </section>

      <article v-if="loadErrorMessage" class="glass-panel error-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Part of the Scope home feed could not be loaded</h2>
        <p class="section-copy">{{ loadErrorMessage }}</p>
      </article>

      <section v-if="isScopeQaHomeMode" class="glass-panel home-audit-preview" aria-labelledby="home-audit-preview-title">
        <div class="home-audit-preview__copy">
          <p class="eyebrow">Scope preview</p>
          <h2 id="home-audit-preview-title">Discovery rails, social proof, and live feed detail load after the first meaningful interaction.</h2>
          <p class="section-copy">
            For the QA session Scope keeps the homepage focused on the hero entry point, then hands off into Explore and the travel circle once the user drills deeper.
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
            description="The strongest Scope signals across food, nature, culture, nightlife, and scenic loops."
          />

          <div v-if="showFeaturedSkeletons" class="spot-grid" role="status" aria-live="polite" aria-label="Loading featured spots">
            <SpotCardSkeleton v-for="index in 4" :key="`featured-skeleton-${index}`" />
          </div>
          <div v-else-if="spotsStore.featuredSpots.length" class="spot-grid stagger-in">
            <SpotCard
              v-for="(spot, index) in spotsStore.featuredSpots"
              :key="spot.id"
              :spot="spot"
              :style="{ '--scope-stagger-index': index }"
            />
          </div>
          <EmptyStatePanel
            v-else-if="!spotsStore.error"
            eyebrow="Trending now"
            title="Featured spots are waiting on the first pin drop"
            description="Once travelers start surfacing standout places, Scope will spotlight them here first."
            icon="map"
            artwork="discovery"
            heading-level="h3"
          />
        </section>

        <section class="section-stack ai-discovery-section">
          <ForYouSection />
          <NearbySpots />
        </section>

        <section ref="feedSectionRef" class="section-stack feed-section">
          <SectionHeading
            eyebrow="Network activity"
            title="Activity Feed"
            description="Recent pins, trip moves, and social proof from the people shaping Scope in real time."
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
                Scope keeps that same energy flowing below with a live feed of fresh pins, finished trips, and social proof.
              </p>
            </div>

            <div class="feed-social-callout__highlights" aria-label="Social features">
              <article class="feed-social-pill surface-card">
                <span class="feed-social-pill__icon" aria-hidden="true">
                  <ScopeIcon name="friends" />
                </span>
                <div class="feed-social-pill__copy">
                  <strong>Friends hub</strong>
                  <p>Requests, mutuals, and future co-planners stay one tap away.</p>
                </div>
              </article>

              <article class="feed-social-pill surface-card">
                <span class="feed-social-pill__icon" aria-hidden="true">
                  <ScopeIcon name="sparkle" />
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
            <!--
              Honest badge letting users know the feed is still running on
              mock content. When real community data is wired up, this pill
              should be removed (or gated behind DEMO_MODE_ENABLED).
            -->
            <p class="feed-mock-banner" role="note">
              <span class="feed-mock-banner__dot" aria-hidden="true" />
              <span class="feed-mock-banner__text">
                <strong>Sample Scope activity</strong>
                <span>Real community posts will replace this once the app is connected to live data.</span>
              </span>
            </p>

            <div v-if="showFeedSkeletons" class="feed-grid feed-grid--loading" role="status" aria-live="polite" aria-label="Loading Scope activity feed">
              <FeedItemSkeleton v-for="index in 4" :key="`feed-skeleton-${index}`" />
            </div>
            <div
              v-else-if="feedStore.items.length"
              class="feed-grid"
              role="list"
              aria-label="Scope activity feed"
            >
              <div
                v-for="(item, index) in feedStore.items"
                :key="item.id"
                class="feed-grid__cell"
                :style="{ '--scope-stagger-index': index }"
                role="listitem"
              >
                <FeedItem :item="item" :preview="!authStore.isAuthenticated" />
              </div>
            </div>
            <EmptyStatePanel
              v-else-if="!feedStore.error"
              eyebrow="Network activity"
              title="No activity yet"
              description="Once your network starts pinning spots and planning trips, the Scope feed will fill in here."
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
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import ForYouSection from '@/components/common/ForYouSection.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import FeedItemSkeleton from '@/components/social/FeedItemSkeleton.vue';
import NearbySpots from '@/components/spots/NearbySpots.vue';
import SpotCardSkeleton from '@/components/spots/SpotCardSkeleton.vue';
import { useAuthStore } from '@/stores/auth';
import { useFeedStore } from '@/stores/feed';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSpotsStore } from '@/stores/spots';
import { DEMO_HERO_IMAGES } from '@/utils/demoMedia';
import { useReducedMotion } from '@/utils/motion';
import { isScopeQaMode } from '@/utils/qaMode';
import { isUiTestEnvironment } from '@/utils/scheduleNonCriticalTask';

const FeedItem = defineAsyncComponent(() => import('@/components/social/FeedItem.vue'));
const SpotCard = defineAsyncComponent(() => import('@/components/spots/SpotCard.vue'));

const authStore = useAuthStore();
const spotsStore = useSpotsStore();
const feedStore = useFeedStore();
const onboardingStore = useOnboardingStore();
const reducedMotion = useReducedMotion();
const isScopeQaHomeMode = isScopeQaMode();
const featuredSectionRef = ref<HTMLElement | null>(null);
const feedSectionRef = ref<HTMLElement | null>(null);
const hasResolvedFeatured = ref(false);
const hasResolvedFeed = ref(false);
const guidedTourLabel = computed(() => (onboardingStore.hasCompleted ? 'Replay tour' : 'Start tour'));
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
  if (!isScopeQaHomeMode) {
    onboardingStore.startIfPending();
  }

  if (isScopeQaHomeMode) {
    return;
  }

  // Trending Destinations peeks above the fold, so start fetching immediately
  // on mount instead of waiting for the user to scroll it into view. This
  // prevents the "scroll and wait for skeletons" feel.
  loadFeaturedSpots();

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

.home-audit-preview {
  align-items: center;
  padding: clamp(var(--space-5), 3vw, var(--space-8));
  background: var(--bg-secondary);
  border: 1px solid var(--border);
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
  padding: clamp(var(--space-5), 3vw, var(--space-8));
  overflow: hidden;
  background: var(--bg-secondary);
  border-color: var(--border);
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
  display: none;
}

.feed-social-callout::after {
  display: none;
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
  background: var(--bg-tertiary);
  border-color: var(--border);
  box-shadow: none;
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

.feed-social-pill__icon :deep(.scope-icon) {
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
  box-shadow: var(--shadow-sm);
}

.feed-social-callout:hover,
.feed-social-callout:focus-within {
  transform: translateY(-2px);
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--glass-border) 92%, transparent);
}

.feed-activity-stage {
  --feed-stage-pad-top: clamp(var(--space-5), 3vw, var(--space-8));
  --feed-stage-pad-x: clamp(var(--space-5), 3.5vw, var(--space-10));
  --feed-stage-pad-bottom: clamp(var(--space-5), 3vw, var(--space-8));
  padding: var(--feed-stage-pad-top) var(--feed-stage-pad-x) var(--feed-stage-pad-bottom);
  gap: clamp(var(--space-5), 2.4vw, var(--space-8));
  align-items: start;
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  box-shadow: var(--shadow-sm);
}

.feed-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(var(--space-5), 2vw, var(--space-8));
  width: 100%;
  align-items: start;
  grid-auto-rows: 1fr;
}

.feed-grid__cell {
  display: flex;
  min-width: 0;
  height: 100%;
}

.feed-grid__cell > :deep(.feed-item) {
  width: 100%;
  height: 100%;
  margin: 0;
}

.feed-grid--loading :deep(.feed-item-skeleton) {
  width: 100%;
  max-width: none;
}

@media (max-width: 1120px) {
  .feed-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .feed-grid {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
}

.feed-mock-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin: 0;
  align-self: flex-start;
  width: min(100%, 34rem);
  padding: 0.75rem 0.95rem;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--accent-gold) 40%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-gold) 10%, var(--glass-bg));
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  line-height: 1.45;
  box-shadow: var(--shadow-sm);
}

.feed-mock-banner__dot {
  margin-top: 0.3rem;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--accent-gold);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-gold) 30%, transparent);
  flex-shrink: 0;
}

.feed-mock-banner__text {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
  color: var(--text-secondary);
}

.feed-mock-banner__text strong {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.01em;
}

.hero-band {
  position: relative;
  isolation: isolate;
  display: grid;
  align-items: center;
  /* Intentionally sized so the Trending Destinations heading peeks above the
     fold on standard laptop viewports. Users should sense there's more below
     the hero without having to scroll blind into skeletons. */
  min-height: min(54vh, 30rem);
  width: 100vw;
  margin-top: calc(var(--shell-content-top) * -1);
  margin-inline: calc(50% - 50vw);
  padding: calc(var(--shell-content-top) + var(--space-8)) var(--shell-side-padding) var(--space-8);
  overflow: hidden;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.hero-band::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  background: color-mix(in srgb, var(--bg-secondary) 66%, transparent);
  pointer-events: none;
}

.hero-band__image {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 48%;
  opacity: 0.72;
  filter: saturate(0.9) contrast(0.94);
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
  width: min(100%, 48rem);
  padding: 0;
  text-align: center;
  overflow: hidden;
}

.hero-panel::before {
  content: none;
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
}

.hero-heading span {
  display: block;
}

.hero-description {
  max-width: 34rem;
  margin: 0 auto;
  font-size: clamp(var(--font-size-body), 1.5vw, var(--font-size-h3));
  color: var(--text-secondary);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-2);
  margin-inline: auto;
  width: fit-content;
  max-width: 100%;
}

.hero-action {
  flex: 0 0 auto;
  min-width: 11rem;
  max-width: 16rem;
  height: 3rem;
  padding: 0 1.5rem;
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold);
  font-size: 0.95rem;
  letter-spacing: 0.005em;
}

.hero-action--primary {
  background: var(--accent-teal);
  color: var(--text-inverse);
  box-shadow: var(--shadow-sm);
}

.hero-action--primary:hover,
.hero-action--primary:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-sm);
}

.hero-action--secondary {
  border-color: var(--border-hover);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.hero-action--secondary:hover,
.hero-action--secondary:focus-visible {
  border-color: var(--accent-teal);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-sm);
}

.hero-action:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.hero-tour-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  margin: var(--space-1) auto 0;
  min-height: 2rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  text-align: center;
  cursor: pointer;
  transition: color var(--transition-fast), transform var(--transition-fast), background var(--transition-fast);
}

.hero-tour-link:hover,
.hero-tour-link:focus-visible {
  color: var(--accent-teal);
  background: transparent;
  transform: none;
}

.hero-tour-link:focus-visible {
  outline: none;
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
  /* Use the same horizontal rail as Trending (page-container only; no extra inset). */
  padding-bottom: var(--space-6);
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
    --feed-stage-pad-top: clamp(var(--space-6), 5.5vw, var(--space-10));
    --feed-stage-pad-x: clamp(var(--space-6), 5vw, var(--space-8));
    --feed-stage-pad-bottom: clamp(var(--space-6), 4.5vw, var(--space-8));
    padding: var(--feed-stage-pad-top) var(--feed-stage-pad-x) var(--feed-stage-pad-bottom);
    gap: var(--space-6);
  }
}

@media (prefers-reduced-motion: reduce) {
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
    min-height: min(50vh, 28rem);
  }

  .hero-panel {
    padding: 0;
  }

  .hero-actions {
    gap: var(--space-3);
  }

  .hero-action {
    flex: 0 0 auto;
    min-width: 9.5rem;
    max-width: none;
    height: 2.75rem;
    padding: 0 1.15rem;
    font-size: 0.9rem;
  }
}

@media (max-width: 420px) {
  .hero-actions {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .hero-action {
    width: 100%;
    min-width: 0;
  }
}
</style>
