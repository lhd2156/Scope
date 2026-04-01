<template>
  <Teleport to="body">
    <Transition name="onboarding-fade">
      <div
        v-if="onboardingStore.isActive && activeStep"
        class="onboarding-overlay"
        role="presentation"
        @click.self="handleSkip"
      >
        <div class="onboarding-overlay__scrim" aria-hidden="true" @click="handleSkip" />

        <div
          v-if="spotlightStyle"
          class="onboarding-overlay__spotlight"
          :style="spotlightStyle"
          aria-hidden="true"
        />

        <section
          ref="cardRef"
          class="onboarding-overlay__card glass-panel"
          :class="{
            'onboarding-overlay__card--welcome': isWelcomeStep,
          }"
          :style="cardStyle"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="descriptionId"
          tabindex="-1"
          @click.stop
        >
          <div v-if="isWelcomeStep" class="onboarding-overlay__welcome-brand">
            <span class="onboarding-overlay__welcome-brand-mark" aria-hidden="true">
              <AtlasIcon name="logo" />
            </span>
            <div class="onboarding-overlay__welcome-brand-copy">
              <p class="onboarding-overlay__welcome-kicker">Guided welcome</p>
              <p class="onboarding-overlay__welcome-caption">A premium tour of the map-first travel workspace</p>
            </div>
          </div>

          <p class="eyebrow onboarding-overlay__eyebrow">
            {{ activeStep.eyebrow }} · Step {{ onboardingStore.activeStepIndex + 1 }} of {{ onboardingStore.totalSteps }}
          </p>
          <h2 :id="titleId" class="onboarding-overlay__title">{{ activeStep.title }}</h2>
          <p :id="descriptionId" class="onboarding-overlay__description">{{ activeStep.description }}</p>

          <div
            v-if="activeStep.highlights?.length"
            class="onboarding-overlay__highlights"
            role="list"
            aria-label="Atlas feature highlights"
          >
            <article
              v-for="(highlight, index) in activeStep.highlights"
              :key="highlight.title"
              class="onboarding-overlay__highlight-card"
              :style="{ '--onboarding-feature-index': index }"
              role="listitem"
              data-test="onboarding-feature-card"
            >
              <span class="onboarding-overlay__highlight-icon" aria-hidden="true">
                <AtlasIcon :name="highlight.icon" />
              </span>
              <div class="onboarding-overlay__highlight-copy">
                <h3 class="onboarding-overlay__highlight-title">{{ highlight.title }}</h3>
                <p class="onboarding-overlay__highlight-description">{{ highlight.description }}</p>
              </div>
            </article>
          </div>

          <p v-if="isWelcomeStep" class="onboarding-overlay__welcome-note">
            We will hop through the real Atlas surfaces next, so you can see where discovery, planning, and community tools live before you start exploring solo.
          </p>

          <div class="onboarding-overlay__meta">
            <div class="onboarding-overlay__progress" role="list" aria-label="Onboarding progress">
              <button
                v-for="(step, index) in onboardingStore.steps"
                :key="step.id"
                type="button"
                class="onboarding-overlay__progress-dot"
                :class="{
                  'is-active': index === onboardingStore.activeStepIndex,
                  'is-complete': index < onboardingStore.activeStepIndex,
                }"
                :aria-label="`Go to step ${index + 1}: ${step.title}`"
                :aria-current="index === onboardingStore.activeStepIndex ? 'step' : undefined"
                @click="handleDotSelect(index)"
              />
            </div>

            <button type="button" class="onboarding-overlay__skip" @click="handleSkip">
              Skip tour
            </button>
          </div>

          <div class="onboarding-overlay__actions">
            <button
              v-if="onboardingStore.activeStepIndex > 0"
              type="button"
              class="button button-secondary"
              @click="onboardingStore.previous"
            >
              Back
            </button>
            <button type="button" class="button button-primary" @click="handleAdvance">
              {{ isLastStep ? 'Finish tour' : activeStep.ctaLabel }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import { useOnboardingStore } from '@/stores/onboarding';
import { useReducedMotion } from '@/utils/motion';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface CardPosition {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  width?: number;
}

const VIEWPORT_MARGIN = 16;
const SPOTLIGHT_PADDING = 14;
const CARD_GAP = 20;
const DEFAULT_CARD_MAX_WIDTH = 360;
const WELCOME_CARD_MAX_WIDTH = 540;
const DEFAULT_CARD_ESTIMATED_HEIGHT = 280;
const WELCOME_CARD_ESTIMATED_HEIGHT = 480;
const MOBILE_BREAKPOINT = 720;
const ROUTE_WAIT_MS = 180;
const TARGET_LOOKUP_ATTEMPTS = 12;
const TARGET_LOOKUP_INTERVAL_MS = 80;

const onboardingStore = useOnboardingStore();
const reducedMotion = useReducedMotion();
const route = useRoute();
const router = useRouter();
const cardRef = ref<HTMLElement | null>(null);
const spotlightRect = ref<SpotlightRect | null>(null);
const cardPosition = ref<CardPosition | null>(null);
const activeStep = computed(() => onboardingStore.activeStep);
const isWelcomeStep = computed(() => activeStep.value?.variant === 'welcome');
const isLastStep = computed(() => onboardingStore.activeStepIndex === onboardingStore.totalSteps - 1);
const titleId = `onboarding-overlay-title-${useId()}`;
const descriptionId = `onboarding-overlay-description-${useId()}`;
let syncSequence = 0;

function resolveCardMaxWidth(): number {
  return isWelcomeStep.value ? WELCOME_CARD_MAX_WIDTH : DEFAULT_CARD_MAX_WIDTH;
}

function resolveEstimatedCardHeight(): number {
  if (cardRef.value?.offsetHeight) {
    return cardRef.value.offsetHeight;
  }

  return isWelcomeStep.value ? WELCOME_CARD_ESTIMATED_HEIGHT : DEFAULT_CARD_ESTIMATED_HEIGHT;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function measureElement(element: HTMLElement): SpotlightRect {
  const bounds = element.getBoundingClientRect();
  const paddedTop = clamp(bounds.top - SPOTLIGHT_PADDING, VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN);
  const paddedLeft = clamp(bounds.left - SPOTLIGHT_PADDING, VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN);
  const paddedRight = clamp(bounds.right + SPOTLIGHT_PADDING, VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN);
  const paddedBottom = clamp(bounds.bottom + SPOTLIGHT_PADDING, VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN);

  return {
    top: paddedTop,
    left: paddedLeft,
    width: Math.max(paddedRight - paddedLeft, 0),
    height: Math.max(paddedBottom - paddedTop, 0),
  };
}

function resolveFallbackCardPosition(): CardPosition {
  const width = Math.min(resolveCardMaxWidth(), window.innerWidth - (VIEWPORT_MARGIN * 2));
  return {
    width,
    left: Math.max((window.innerWidth - width) / 2, VIEWPORT_MARGIN),
    bottom: VIEWPORT_MARGIN,
  };
}

function resolveStandaloneCardPosition(): CardPosition {
  const width = Math.min(resolveCardMaxWidth(), window.innerWidth - (VIEWPORT_MARGIN * 2));
  const estimatedHeight = resolveEstimatedCardHeight();

  if (window.innerWidth <= MOBILE_BREAKPOINT) {
    return {
      width,
      left: Math.max((window.innerWidth - width) / 2, VIEWPORT_MARGIN),
      bottom: VIEWPORT_MARGIN,
    };
  }

  return {
    width,
    left: clamp((window.innerWidth - width) / 2, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
    top: clamp(
      (window.innerHeight - estimatedHeight) / 2,
      VIEWPORT_MARGIN,
      window.innerHeight - estimatedHeight - VIEWPORT_MARGIN,
    ),
  };
}

function resolveCardPosition(rect: SpotlightRect): CardPosition {
  const width = Math.min(resolveCardMaxWidth(), window.innerWidth - (VIEWPORT_MARGIN * 2));
  const estimatedHeight = resolveEstimatedCardHeight();
  const stepPlacement = activeStep.value?.placement ?? 'bottom';

  if (window.innerWidth <= MOBILE_BREAKPOINT) {
    return {
      width,
      left: Math.max((window.innerWidth - width) / 2, VIEWPORT_MARGIN),
      bottom: VIEWPORT_MARGIN,
    };
  }

  const centeredLeft = clamp(
    rect.left + (rect.width / 2) - (width / 2),
    VIEWPORT_MARGIN,
    window.innerWidth - width - VIEWPORT_MARGIN,
  );
  const centeredTop = clamp(
    rect.top + (rect.height / 2) - (estimatedHeight / 2),
    VIEWPORT_MARGIN,
    window.innerHeight - estimatedHeight - VIEWPORT_MARGIN,
  );

  const placements: Array<CardPosition | null> = stepPlacement === 'center'
    ? [{ width, left: centeredLeft, top: centeredTop }]
    : [
        stepPlacement === 'top'
          ? { width, left: centeredLeft, top: rect.top - estimatedHeight - CARD_GAP }
          : null,
        stepPlacement === 'right'
          ? { width, left: rect.left + rect.width + CARD_GAP, top: centeredTop }
          : null,
        stepPlacement === 'bottom'
          ? { width, left: centeredLeft, top: rect.top + rect.height + CARD_GAP }
          : null,
        stepPlacement === 'left'
          ? { width, left: rect.left - width - CARD_GAP, top: centeredTop }
          : null,
        { width, left: centeredLeft, top: rect.top + rect.height + CARD_GAP },
        { width, left: centeredLeft, top: rect.top - estimatedHeight - CARD_GAP },
        { width, left: rect.left + rect.width + CARD_GAP, top: centeredTop },
        { width, left: rect.left - width - CARD_GAP, top: centeredTop },
      ];

  const matchingPlacement = placements.find((candidate) => {
    if (!candidate) {
      return false;
    }

    const resolvedLeft = candidate.left ?? VIEWPORT_MARGIN;
    const resolvedTop = candidate.top ?? VIEWPORT_MARGIN;

    return (
      resolvedLeft >= VIEWPORT_MARGIN
      && resolvedTop >= VIEWPORT_MARGIN
      && resolvedLeft + width <= window.innerWidth - VIEWPORT_MARGIN
      && resolvedTop + estimatedHeight <= window.innerHeight - VIEWPORT_MARGIN
    );
  });

  if (matchingPlacement) {
    return {
      width,
      left: clamp(matchingPlacement.left ?? centeredLeft, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
      top: clamp(matchingPlacement.top ?? centeredTop, VIEWPORT_MARGIN, window.innerHeight - estimatedHeight - VIEWPORT_MARGIN),
    };
  }

  return resolveFallbackCardPosition();
}

async function waitForTarget(selector: string): Promise<HTMLElement | null> {
  for (let attempt = 0; attempt < TARGET_LOOKUP_ATTEMPTS; attempt += 1) {
    const target = document.querySelector<HTMLElement>(selector);
    if (target) {
      return target;
    }

    await delay(TARGET_LOOKUP_INTERVAL_MS);
  }

  return null;
}

async function syncPresentation(): Promise<void> {
  const currentStep = activeStep.value;
  if (!onboardingStore.isActive || !currentStep || typeof window === 'undefined') {
    spotlightRect.value = null;
    cardPosition.value = null;
    return;
  }

  const syncId = ++syncSequence;

  if (route.name !== currentStep.routeName) {
    try {
      await router.push({ name: currentStep.routeName });
    } catch {
      onboardingStore.close();
      return;
    }

    if (!reducedMotion.value) {
      await delay(ROUTE_WAIT_MS);
    }
  }

  await nextTick();

  if (syncId !== syncSequence || !activeStep.value) {
    return;
  }

  if (currentStep.showSpotlight === false) {
    spotlightRect.value = null;
    cardPosition.value = resolveStandaloneCardPosition();
    await nextTick();
    cardRef.value?.focus();
    return;
  }

  const target = await waitForTarget(currentStep.selector);
  if (syncId !== syncSequence) {
    return;
  }

  if (!target) {
    spotlightRect.value = null;
    cardPosition.value = resolveFallbackCardPosition();
    await nextTick();
    cardRef.value?.focus();
    return;
  }

  target.scrollIntoView({
    behavior: reducedMotion.value ? 'auto' : 'smooth',
    block: 'center',
    inline: 'nearest',
  });

  if (!reducedMotion.value) {
    await delay(ROUTE_WAIT_MS);
  }

  await nextTick();

  if (syncId !== syncSequence) {
    return;
  }

  const nextSpotlightRect = measureElement(target);
  spotlightRect.value = nextSpotlightRect;
  cardPosition.value = resolveCardPosition(nextSpotlightRect);
  await nextTick();
  cardRef.value?.focus();
}

function refreshLayout(): void {
  if (!onboardingStore.isActive || !activeStep.value) {
    return;
  }

  if (activeStep.value.showSpotlight === false) {
    spotlightRect.value = null;
    cardPosition.value = resolveStandaloneCardPosition();
    return;
  }

  const target = document.querySelector<HTMLElement>(activeStep.value.selector);
  if (!target) {
    spotlightRect.value = null;
    cardPosition.value = resolveFallbackCardPosition();
    return;
  }

  const nextSpotlightRect = measureElement(target);
  spotlightRect.value = nextSpotlightRect;
  cardPosition.value = resolveCardPosition(nextSpotlightRect);
}

function handleAdvance(): void {
  if (isLastStep.value) {
    onboardingStore.finish();
    return;
  }

  onboardingStore.next();
}

function handleSkip(): void {
  onboardingStore.skip();
}

function handleDotSelect(stepIndex: number): void {
  onboardingStore.goToStep(stepIndex);
}

function handleKeydown(event: KeyboardEvent): void {
  if (!onboardingStore.isActive) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    handleSkip();
    return;
  }

  if (event.key === 'ArrowRight' || event.key === 'Enter') {
    event.preventDefault();
    handleAdvance();
    return;
  }

  if (event.key === 'ArrowLeft' && onboardingStore.activeStepIndex > 0) {
    event.preventDefault();
    onboardingStore.previous();
  }
}

const spotlightStyle = computed(() => {
  if (!spotlightRect.value) {
    return null;
  }

  return {
    top: `${spotlightRect.value.top}px`,
    left: `${spotlightRect.value.left}px`,
    width: `${spotlightRect.value.width}px`,
    height: `${spotlightRect.value.height}px`,
  };
});

const cardStyle = computed(() => {
  const position = cardPosition.value ?? resolveFallbackCardPosition();
  return {
    width: `${position.width ?? Math.min(resolveCardMaxWidth(), window.innerWidth - (VIEWPORT_MARGIN * 2))}px`,
    top: position.top === undefined ? 'auto' : `${position.top}px`,
    left: position.left === undefined ? 'auto' : `${position.left}px`,
    right: position.right === undefined ? 'auto' : `${position.right}px`,
    bottom: position.bottom === undefined ? 'auto' : `${position.bottom}px`,
  };
});

watch(
  () => onboardingStore.isActive,
  (isActive) => {
    if (!isActive) {
      spotlightRect.value = null;
      cardPosition.value = null;
      return;
    }

    void syncPresentation();
  },
);

watch(activeStep, () => {
  if (!onboardingStore.isActive) {
    return;
  }

  void syncPresentation();
});

watch(
  () => route.fullPath,
  () => {
    if (!onboardingStore.isActive) {
      return;
    }

    void syncPresentation();
  },
);

onMounted(() => {
  window.addEventListener('resize', refreshLayout);
  window.addEventListener('scroll', refreshLayout, true);
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', refreshLayout);
  window.removeEventListener('scroll', refreshLayout, true);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-tooltip) + 1);
}

.onboarding-overlay__scrim {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 42%),
    color-mix(in srgb, var(--bg-primary) 78%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.onboarding-overlay__spotlight,
.onboarding-overlay__card {
  position: absolute;
}

.onboarding-overlay__spotlight {
  border-radius: var(--radius-2xl);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 55%, transparent);
  background: color-mix(in srgb, var(--accent-teal) 8%, transparent);
  box-shadow:
    0 0 0 9999px color-mix(in srgb, var(--bg-primary) 72%, transparent),
    0 0 0 1px color-mix(in srgb, var(--text-primary) 24%, transparent),
    0 0 2rem color-mix(in srgb, var(--accent-teal) 22%, transparent);
  pointer-events: none;
}

.onboarding-overlay__spotlight::after {
  content: '';
  position: absolute;
  inset: -0.4rem;
  border-radius: inherit;
  border: 1px solid color-mix(in srgb, var(--text-primary) 18%, transparent);
  opacity: 0.78;
}

.onboarding-overlay__card {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-6);
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--glass-border) 100%, transparent),
    0 0 2rem color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.onboarding-overlay__card--welcome {
  gap: var(--space-5);
  padding: clamp(var(--space-6), 4vw, var(--space-8));
  overflow: hidden;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 46%),
    linear-gradient(160deg, color-mix(in srgb, var(--glass-bg) 94%, transparent), color-mix(in srgb, var(--bg-elevated) 94%, transparent));
}

.onboarding-overlay__card--welcome::before {
  content: '';
  position: absolute;
  inset: auto -16% -34% 32%;
  height: 16rem;
  border-radius: 999px;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent-teal) 24%, transparent), transparent 68%);
  filter: blur(44px);
  opacity: 0.72;
  pointer-events: none;
}

.onboarding-overlay__card--welcome > * {
  position: relative;
  z-index: 1;
}

.onboarding-overlay__welcome-brand {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.onboarding-overlay__welcome-brand-mark {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--glass-bg));
  color: var(--accent-teal);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 24%, transparent),
    0 0 1.5rem color-mix(in srgb, var(--accent-teal) 24%, transparent);
}

.onboarding-overlay__welcome-brand-mark :deep(.atlas-icon) {
  width: 1.75rem;
  height: 1.75rem;
}

.onboarding-overlay__welcome-brand-copy {
  display: grid;
  gap: 0.2rem;
}

.onboarding-overlay__welcome-kicker,
.onboarding-overlay__welcome-caption,
.onboarding-overlay__welcome-note,
.onboarding-overlay__highlight-title,
.onboarding-overlay__highlight-description {
  margin: 0;
}

.onboarding-overlay__welcome-kicker {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.onboarding-overlay__welcome-caption {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.onboarding-overlay__highlights {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.onboarding-overlay__highlight-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--bg-elevated) 82%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent),
    0 0.75rem 2rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
}

.onboarding-overlay__highlight-icon {
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--accent-teal) 16%, transparent);
  color: var(--accent-teal);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 24%, transparent);
}

.onboarding-overlay__highlight-icon :deep(.atlas-icon) {
  width: 1.2rem;
  height: 1.2rem;
}

.onboarding-overlay__highlight-copy {
  display: grid;
  gap: 0.35rem;
}

.onboarding-overlay__highlight-title {
  font-size: 0.98rem;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.onboarding-overlay__highlight-description {
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.45;
}

.onboarding-overlay__welcome-note {
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--accent-teal) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 16%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: 1.6;
}

.onboarding-overlay__eyebrow,
.onboarding-overlay__title,
.onboarding-overlay__description {
  margin: 0;
}

.onboarding-overlay__title {
  font-size: clamp(var(--font-size-h2), 2.2vw, var(--font-size-h1));
  line-height: var(--line-height-tight);
}

.onboarding-overlay__description {
  color: var(--text-secondary);
}

.onboarding-overlay__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.onboarding-overlay__progress {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.onboarding-overlay__progress-dot {
  width: 0.85rem;
  height: 0.85rem;
  border: none;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--text-primary) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--glass-border) 90%, transparent);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.onboarding-overlay__progress-dot:hover,
.onboarding-overlay__progress-dot:focus-visible {
  outline: none;
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--accent-teal) 28%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 35%, transparent),
    0 0 0 0.2rem color-mix(in srgb, var(--accent-teal-light) 55%, transparent);
}

.onboarding-overlay__progress-dot.is-complete,
.onboarding-overlay__progress-dot.is-active {
  background: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}

.onboarding-overlay__progress-dot.is-active {
  transform: scale(1.16);
}

.onboarding-overlay__skip {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: color var(--transition-fast), transform var(--transition-fast);
}

.onboarding-overlay__skip:hover,
.onboarding-overlay__skip:focus-visible {
  outline: none;
  color: var(--text-primary);
  transform: translateY(-1px);
}

.onboarding-overlay__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
}

.onboarding-fade-enter-active,
.onboarding-fade-leave-active {
  transition: opacity var(--transition-normal), transform var(--transition-normal);
}

.onboarding-fade-enter-from,
.onboarding-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .onboarding-overlay__spotlight {
    animation: onboarding-spotlight-pulse 1.8s ease-in-out infinite;
  }

  .onboarding-overlay__card--welcome::before {
    animation: onboarding-aurora-drift 6s ease-in-out infinite;
  }

  .onboarding-overlay__welcome-brand,
  .onboarding-overlay__welcome-note {
    animation: onboarding-welcome-rise 0.55s ease both;
  }

  .onboarding-overlay__welcome-note {
    animation-delay: 260ms;
  }

  .onboarding-overlay__highlight-card {
    animation: onboarding-feature-enter 0.48s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(var(--onboarding-feature-index, 0) * 90ms + 120ms);
  }
}

@media (prefers-reduced-motion: reduce) {
  .onboarding-fade-enter-active,
  .onboarding-fade-leave-active {
    transition-duration: 1ms;
  }

  .onboarding-overlay__spotlight,
  .onboarding-overlay__card--welcome::before,
  .onboarding-overlay__welcome-brand,
  .onboarding-overlay__welcome-note,
  .onboarding-overlay__highlight-card {
    animation: none;
  }

  .onboarding-overlay__progress-dot,
  .onboarding-overlay__skip {
    transition-duration: 1ms;
  }

  .onboarding-overlay__progress-dot:hover,
  .onboarding-overlay__progress-dot:focus-visible,
  .onboarding-overlay__skip:hover,
  .onboarding-overlay__skip:focus-visible,
  .onboarding-overlay__progress-dot.is-active {
    transform: none;
  }
}

@media (max-width: 720px) {
  .onboarding-overlay__card {
    right: var(--space-4) !important;
    left: var(--space-4) !important;
    width: auto !important;
    bottom: var(--space-4) !important;
  }

  .onboarding-overlay__welcome-brand {
    align-items: flex-start;
  }

  .onboarding-overlay__highlights {
    grid-template-columns: 1fr;
  }

  .onboarding-overlay__meta,
  .onboarding-overlay__actions {
    justify-content: stretch;
  }

  .onboarding-overlay__progress {
    width: 100%;
    justify-content: center;
  }

  .onboarding-overlay__skip,
  .onboarding-overlay__actions .button {
    flex: 1 1 12rem;
    text-align: center;
  }
}

@keyframes onboarding-spotlight-pulse {
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.006);
  }
}

@keyframes onboarding-feature-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes onboarding-welcome-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes onboarding-aurora-drift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(-1.25rem, -0.75rem, 0) scale(1.06);
  }
}
</style>
