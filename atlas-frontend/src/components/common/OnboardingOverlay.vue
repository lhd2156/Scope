<template>
  <Teleport to="body">
    <Transition name="onboarding-fade">
      <div
        v-if="onboardingStore.isActive && activeStep"
        class="onboarding-overlay"
        role="presentation"
        @click.self="onboardingStore.finish"
      >
        <div class="onboarding-overlay__scrim" aria-hidden="true" @click="onboardingStore.finish" />

        <div
          v-if="spotlightStyle"
          class="onboarding-overlay__spotlight"
          :style="spotlightStyle"
          aria-hidden="true"
        />

        <section
          ref="cardRef"
          class="onboarding-overlay__card glass-panel"
          :style="cardStyle"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="descriptionId"
          tabindex="-1"
          @click.stop
        >
          <p class="eyebrow onboarding-overlay__eyebrow">
            {{ activeStep.eyebrow }} · Step {{ onboardingStore.activeStepIndex + 1 }} of {{ onboardingStore.totalSteps }}
          </p>
          <h2 :id="titleId" class="onboarding-overlay__title">{{ activeStep.title }}</h2>
          <p :id="descriptionId" class="onboarding-overlay__description">{{ activeStep.description }}</p>

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
const CARD_MAX_WIDTH = 360;
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
const isLastStep = computed(() => onboardingStore.activeStepIndex === onboardingStore.totalSteps - 1);
const titleId = `onboarding-overlay-title-${useId()}`;
const descriptionId = `onboarding-overlay-description-${useId()}`;
let syncSequence = 0;

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
  const width = Math.min(CARD_MAX_WIDTH, window.innerWidth - (VIEWPORT_MARGIN * 2));
  return {
    width,
    left: Math.max((window.innerWidth - width) / 2, VIEWPORT_MARGIN),
    bottom: VIEWPORT_MARGIN,
  };
}

function resolveCardPosition(rect: SpotlightRect): CardPosition {
  const width = Math.min(CARD_MAX_WIDTH, window.innerWidth - (VIEWPORT_MARGIN * 2));
  const estimatedHeight = cardRef.value?.offsetHeight ?? 240;
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
      onboardingStore.finish();
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

function handleKeydown(event: KeyboardEvent): void {
  if (!onboardingStore.isActive) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    onboardingStore.finish();
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
    width: `${position.width ?? Math.min(CARD_MAX_WIDTH, window.innerWidth - (VIEWPORT_MARGIN * 2))}px`,
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
}

@media (prefers-reduced-motion: reduce) {
  .onboarding-fade-enter-active,
  .onboarding-fade-leave-active {
    transition-duration: 1ms;
  }

  .onboarding-overlay__spotlight {
    animation: none;
  }
}

@media (max-width: 720px) {
  .onboarding-overlay__card {
    right: var(--space-4) !important;
    left: var(--space-4) !important;
    width: auto !important;
    bottom: var(--space-4) !important;
  }

  .onboarding-overlay__actions {
    justify-content: stretch;
  }

  .onboarding-overlay__actions .button {
    flex: 1 1 12rem;
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
</style>
