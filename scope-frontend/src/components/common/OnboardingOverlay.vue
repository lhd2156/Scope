<template>
  <Teleport to="body">
    <Transition name="onboarding-fade">
      <div
        v-if="onboardingStore.isActive && activeStep"
        class="onboarding-overlay"
        :class="{
          'onboarding-overlay--map-step': isMapStep,
          'onboarding-overlay--anchored-intro': isAnchoredStepIntro,
        }"
        role="presentation"
        @click.self="handleSkip"
        @wheel.prevent
        @touchmove.prevent
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
            'onboarding-overlay__card--solid': isSolidCard,
          }"
          :style="cardStyle"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="descriptionId"
          tabindex="-1"
          @click.stop
          @wheel.prevent.stop
          @touchmove.prevent.stop
        >
          <div v-if="isWelcomeStep" class="onboarding-overlay__welcome-brand">
            <span class="onboarding-overlay__welcome-brand-mark" aria-hidden="true">
              <img class="onboarding-overlay__welcome-brand-mark-image" :src="SCOPE_TRIPS_LOGO_MARK_SRC" alt="" />
            </span>
            <div class="onboarding-overlay__welcome-brand-copy">
              <p class="onboarding-overlay__welcome-kicker">Guided welcome</p>
              <p class="onboarding-overlay__welcome-caption">A premium tour of the map-first travel workspace</p>
            </div>
          </div>

          <p class="eyebrow onboarding-overlay__eyebrow">
            {{ activeStep.eyebrow }} - Step {{ onboardingStore.activeStepIndex + 1 }} of {{ onboardingStore.totalSteps }}
          </p>
          <h2 :id="titleId" class="onboarding-overlay__title">{{ activeStep.title }}</h2>
          <p :id="descriptionId" class="onboarding-overlay__description">{{ activeStep.description }}</p>

          <div
            v-if="activeStep.highlights?.length"
            class="onboarding-overlay__highlights"
            role="list"
            aria-label="Scope feature highlights"
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
                <ScopeIcon :name="highlight.icon" />
              </span>
              <div class="onboarding-overlay__highlight-copy">
                <h3 class="onboarding-overlay__highlight-title">{{ highlight.title }}</h3>
                <p class="onboarding-overlay__highlight-description">{{ highlight.description }}</p>
              </div>
            </article>
          </div>

          <div class="onboarding-overlay__meta">
            <ol class="onboarding-overlay__progress" aria-label="Onboarding progress">
              <li v-for="(step, index) in onboardingStore.steps" :key="step.id" class="onboarding-overlay__progress-item">
                <button
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
              </li>
            </ol>

            <button type="button" class="onboarding-overlay__skip" @click="handleSkip">
              Skip tour
            </button>

            <div class="onboarding-overlay__actions">
              <button
                v-if="hasBackAction"
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
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
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
const BODY_LOCK_CLASS = 'scope-onboarding-lock';
const CARD_MAX_WIDTH = 408;
const CARD_ESTIMATED_HEIGHT = 420;
const MOBILE_BREAKPOINT = 720;
const ROUTE_WAIT_MS = 260;
const ANCHORED_STEP_STAGE_MS = 180;
const TARGET_LOOKUP_ATTEMPTS = 12;
const TARGET_LOOKUP_INTERVAL_MS = 80;
const SCOPE_TRIPS_LOGO_MARK_SRC = '/branding/scope-trips-logo-mark.png';

const onboardingStore = useOnboardingStore();
const reducedMotion = useReducedMotion();
const route = useRoute();
const router = useRouter();
const cardRef = ref<HTMLElement | null>(null);
const spotlightRect = ref<SpotlightRect | null>(null);
const cardPosition = ref<CardPosition | null>(null);
const isAnchoredStepIntro = ref(false);
const activeStep = computed(() => onboardingStore.activeStep);
const isWelcomeStep = computed(() => activeStep.value?.variant === 'welcome');
const isMapStep = computed(() => activeStep.value?.routeName === 'map');
const isLastStep = computed(() => onboardingStore.activeStepIndex === onboardingStore.totalSteps - 1);
const hasBackAction = computed(() => onboardingStore.activeStepIndex > 0);
const isSolidCard = computed(() => activeStep.value?.showSpotlight === false || isAnchoredStepIntro.value);
const titleId = `onboarding-overlay-title-${useId()}`;
const descriptionId = `onboarding-overlay-description-${useId()}`;
let syncSequence = 0;
let activeTargetElements: HTMLElement[] = [];

function setDocumentScrollLock(isLocked: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle(BODY_LOCK_CLASS, isLocked);
  document.body.classList.toggle(BODY_LOCK_CLASS, isLocked);
}

function resolveCardMaxWidth(): number {
  return CARD_MAX_WIDTH;
}

function resolveEstimatedCardHeight(): number {
  return Math.min(CARD_ESTIMATED_HEIGHT, window.innerHeight - (VIEWPORT_MARGIN * 2));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isTargetVisible(element: HTMLElement): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  const bounds = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  return (
    bounds.width > 0
    && bounds.height > 0
    && computedStyle.display !== 'none'
    && computedStyle.visibility !== 'hidden'
  );
}

function findVisibleTarget(selector: string): HTMLElement | null {
  const targets = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return targets.find((target) => isTargetVisible(target)) ?? null;
}

function resolveVisibleTargets(selectors?: readonly string[]): HTMLElement[] {
  return (selectors ?? [])
    .map((selector) => findVisibleTarget(selector))
    .filter((target): target is HTMLElement => Boolean(target));
}

function setActiveTargets(targets: readonly HTMLElement[]): void {
  const nextActiveTargets = Array.from(new Set(targets));
  const nextTargetSet = new Set(nextActiveTargets);

  activeTargetElements.forEach((target) => {
    if (!nextTargetSet.has(target)) {
      target.removeAttribute('data-onboarding-active');
    }
  });

  nextActiveTargets.forEach((target) => {
    target.setAttribute('data-onboarding-active', 'true');
  });

  activeTargetElements = nextActiveTargets;
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

function resolveDefaultCardPosition(): CardPosition {
  if (activeStep.value?.showSpotlight === false || isAnchoredStepIntro.value || activeStep.value?.routeName === 'map') {
    return resolveStandaloneCardPosition();
  }

  return resolveFallbackCardPosition();
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
    const target = findVisibleTarget(selector);
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
    isAnchoredStepIntro.value = false;
    setActiveTargets([]);
    return;
  }

  const syncId = ++syncSequence;
  const shouldStageAnchoredStep = currentStep.routeName === 'map' && currentStep.showSpotlight !== false && !reducedMotion.value;

  isAnchoredStepIntro.value = shouldStageAnchoredStep;

  if (shouldStageAnchoredStep) {
    spotlightRect.value = null;
    cardPosition.value = resolveStandaloneCardPosition();
    setActiveTargets(resolveVisibleTargets(currentStep.accentSelectors));
    await nextTick();
    await delay(ANCHORED_STEP_STAGE_MS);

    if (syncId !== syncSequence) {
      return;
    }
  }

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
    isAnchoredStepIntro.value = false;
    spotlightRect.value = null;
    cardPosition.value = resolveStandaloneCardPosition();
    setActiveTargets(resolveVisibleTargets(currentStep.accentSelectors));
    await nextTick();
    cardRef.value?.focus();
    return;
  }

  const target = await waitForTarget(currentStep.selector);
  if (syncId !== syncSequence) {
    return;
  }

  const accentTargets = resolveVisibleTargets(currentStep.accentSelectors);

  if (!target) {
    isAnchoredStepIntro.value = false;
    spotlightRect.value = null;
    cardPosition.value = currentStep.routeName === 'map'
      ? resolveStandaloneCardPosition()
      : resolveFallbackCardPosition();
    setActiveTargets(accentTargets);
    await nextTick();
    cardRef.value?.focus();
    return;
  }

  setActiveTargets([target, ...accentTargets]);

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

  if (!target.isConnected || !isTargetVisible(target)) {
    const refreshedAccentTargets = resolveVisibleTargets(currentStep.accentSelectors);
    isAnchoredStepIntro.value = false;
    spotlightRect.value = null;
    cardPosition.value = currentStep.routeName === 'map'
      ? resolveStandaloneCardPosition()
      : resolveFallbackCardPosition();
    setActiveTargets(refreshedAccentTargets);
    await nextTick();
    cardRef.value?.focus();
    return;
  }

  const nextSpotlightRect = measureElement(target);
  isAnchoredStepIntro.value = false;
  spotlightRect.value = nextSpotlightRect;
  cardPosition.value = resolveCardPosition(nextSpotlightRect);
  await nextTick();
  cardRef.value?.focus();
}

function refreshLayout(): void {
  if (!onboardingStore.isActive || !activeStep.value) {
    setActiveTargets([]);
    return;
  }

  if (activeStep.value.showSpotlight === false) {
    isAnchoredStepIntro.value = false;
    spotlightRect.value = null;
    cardPosition.value = resolveStandaloneCardPosition();
    setActiveTargets(resolveVisibleTargets(activeStep.value.accentSelectors));
    return;
  }

  if (isAnchoredStepIntro.value) {
    spotlightRect.value = null;
    cardPosition.value = resolveStandaloneCardPosition();
    setActiveTargets(resolveVisibleTargets(activeStep.value.accentSelectors));
    return;
  }

  const target = findVisibleTarget(activeStep.value.selector);
  const accentTargets = resolveVisibleTargets(activeStep.value.accentSelectors);
  if (!target) {
    spotlightRect.value = null;
    cardPosition.value = resolveFallbackCardPosition();
    setActiveTargets(accentTargets);
    return;
  }

  setActiveTargets([target, ...accentTargets]);

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
  const position = cardPosition.value ?? resolveDefaultCardPosition();

  return {
    width: `${position.width ?? Math.min(resolveCardMaxWidth(), window.innerWidth - (VIEWPORT_MARGIN * 2))}px`,
    top: position.top === undefined ? 'auto' : `${position.top}px`,
    left: position.left === undefined ? 'auto' : `${position.left}px`,
    right: position.right === undefined ? 'auto' : `${position.right}px`,
    bottom: position.bottom === undefined ? 'auto' : `${position.bottom}px`,
  };
});

defineExpose({
  ...(import.meta.env.MODE === 'test'
    ? {
        __coverage: {
          cardStyle,
          clamp,
          delay,
          findVisibleTarget,
          handleAdvance,
          handleDotSelect,
          handleKeydown,
          handleSkip,
          isTargetVisible,
          measureElement,
          refreshLayout,
          resolveCardMaxWidth,
          resolveCardPosition,
          resolveDefaultCardPosition,
          resolveEstimatedCardHeight,
          resolveFallbackCardPosition,
          resolveStandaloneCardPosition,
          resolveVisibleTargets,
          setActiveTargets,
          setDocumentScrollLock,
          spotlightStyle,
          syncPresentation,
          waitForTarget,
        },
      }
    : {}),
});

watch(
  () => onboardingStore.isActive,
  (isActive) => {
    if (!isActive) {
      syncSequence += 1;
      spotlightRect.value = null;
      cardPosition.value = null;
      isAnchoredStepIntro.value = false;
      setActiveTargets([]);
      setDocumentScrollLock(false);
      return;
    }

    setDocumentScrollLock(true);
    void syncPresentation();
  },
  { immediate: true },
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
  setDocumentScrollLock(false);
  setActiveTargets([]);
});
</script>

<style scoped>
:global(html.scope-onboarding-lock),
:global(body.scope-onboarding-lock) {
  overflow: hidden !important;
  overscroll-behavior: none;
}

.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-tooltip) + 1);
  overflow: hidden;
  overscroll-behavior: none;
}

.onboarding-overlay__scrim {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 42%),
    color-mix(in srgb, var(--bg-primary) 78%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition:
    background 520ms cubic-bezier(0.22, 1, 0.36, 1),
    backdrop-filter 520ms cubic-bezier(0.22, 1, 0.36, 1),
    -webkit-backdrop-filter 520ms cubic-bezier(0.22, 1, 0.36, 1);
}

.onboarding-overlay--map-step .onboarding-overlay__scrim {
  background:
    radial-gradient(circle at 72% 38%, color-mix(in srgb, var(--accent-teal) 8%, transparent), transparent 34%),
    color-mix(in srgb, var(--bg-primary) 34%, transparent);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
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

.onboarding-overlay--map-step .onboarding-overlay__spotlight {
  box-shadow:
    0 0 0 9999px color-mix(in srgb, var(--bg-primary) 30%, transparent),
    0 0 0 1px color-mix(in srgb, var(--text-primary) 24%, transparent);
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
  --onboarding-card-surface:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-teal) 9%, var(--bg-secondary)), transparent 48%),
    linear-gradient(165deg, color-mix(in srgb, var(--bg-secondary) 100%, var(--bg-tertiary)), color-mix(in srgb, var(--bg-primary) 86%, var(--bg-secondary)));

  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-height: min(23.75rem, calc(100dvh - (var(--space-4) * 2)));
  height: auto;
  max-height: calc(100dvh - (var(--space-4) * 2));
  padding: clamp(1.05rem, 1.6vw, 1.35rem);
  overflow: hidden;
  overscroll-behavior: contain;
  background: var(--onboarding-card-surface);
  border-color: color-mix(in srgb, var(--glass-border) 84%, var(--accent-teal) 16%);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--glass-border) 100%, transparent),
    0 1.25rem 3rem color-mix(in srgb, var(--bg-primary) 28%, transparent);
  transition:
    top 560ms cubic-bezier(0.16, 1, 0.3, 1),
    left 560ms cubic-bezier(0.16, 1, 0.3, 1),
    right 560ms cubic-bezier(0.16, 1, 0.3, 1),
    bottom 560ms cubic-bezier(0.16, 1, 0.3, 1),
    width 360ms cubic-bezier(0.16, 1, 0.3, 1),
    background 420ms ease,
    box-shadow var(--transition-normal);
  will-change: top, left, right, bottom;
}

.onboarding-overlay__card--solid {
  background: var(--onboarding-card-surface);
}

.onboarding-overlay__card--welcome {
  gap: 0.55rem;
  min-height: min(27.5rem, calc(100dvh - (var(--space-4) * 2)));
  background: var(--onboarding-card-surface);
}

.onboarding-overlay__card--welcome::before {
  display: none;
}

.onboarding-overlay__card--welcome > * {
  position: relative;
  z-index: 1;
}

.onboarding-overlay__welcome-brand {
  display: flex;
  align-items: center;
  gap: 0.72rem;
}

.onboarding-overlay__welcome-brand-mark {
  display: grid;
  place-items: center;
  width: 2.28rem;
  height: 2.28rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 20%, transparent),
    0 0 1.25rem color-mix(in srgb, var(--accent-teal) 22%, transparent);
  overflow: hidden;
}

.onboarding-overlay__welcome-brand-mark-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.onboarding-overlay__welcome-brand-copy {
  display: grid;
  gap: 0.2rem;
}

.onboarding-overlay__welcome-kicker,
.onboarding-overlay__welcome-caption,
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
  font-size: var(--font-size-caption);
}

.onboarding-overlay__highlights {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.onboarding-overlay__highlight-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem;
  align-items: flex-start;
  min-width: 0;
  padding: 0.56rem;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--bg-elevated) 82%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent),
    0 0.5rem 1.5rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
}

.onboarding-overlay__highlight-icon {
  display: grid;
  place-items: center;
  width: 1.62rem;
  height: 1.62rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent-teal) 16%, transparent);
  color: var(--accent-teal);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 24%, transparent);
}

.onboarding-overlay__highlight-icon :deep(.scope-icon) {
  width: 0.92rem;
  height: 0.92rem;
}

.onboarding-overlay__highlight-copy {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.onboarding-overlay__highlight-title {
  font-size: 0.76rem;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  line-height: 1.25;
}

.onboarding-overlay__highlight-description {
  color: var(--text-secondary);
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.69rem;
  line-height: 1.28;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.onboarding-overlay__eyebrow,
.onboarding-overlay__title,
.onboarding-overlay__description {
  margin: 0;
}

.onboarding-overlay__title {
  font-size: clamp(1.08rem, 1.24vw, 1.28rem);
  line-height: var(--line-height-tight);
}

.onboarding-overlay__description {
  color: var(--text-secondary);
  font-size: 0.8rem;
  line-height: 1.38;
}

.onboarding-overlay__meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: var(--space-3);
  row-gap: 0.75rem;
  margin-top: auto;
}

.onboarding-overlay__progress {
  display: inline-flex;
  grid-column: 1;
  grid-row: 1;
  align-items: center;
  gap: 0.46rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.onboarding-overlay__progress-item {
  display: flex;
}

.onboarding-overlay__progress-dot {
  width: 0.86rem;
  height: 0.86rem;
  padding: 0;
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
  grid-column: 2;
  grid-row: 1;
  justify-self: end;
  border: none;
  background: transparent;
  padding: 0 0.1rem;
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
  grid-column: 1 / -1;
  grid-row: 2;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 0.55rem;
  width: 100%;
}

.onboarding-overlay__actions .button {
  min-height: 2.42rem;
  padding-block: 0.55rem;
  padding-inline: 1rem;
  line-height: 1;
  font-size: 0.88rem;
}

.onboarding-overlay__actions .button-secondary {
  flex: 0 0 6.4rem;
  background: color-mix(in srgb, var(--bg-primary) 18%, transparent);
}

.onboarding-overlay__actions .button-primary {
  flex: 1 1 auto;
  min-width: 0;
  box-shadow: none;
}

.onboarding-overlay__actions .button-primary:only-child {
  flex: 0 1 12.6rem;
  margin-left: auto;
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
  .onboarding-overlay__card--welcome::before {
    animation: onboarding-aurora-drift 6s ease-in-out infinite;
  }

  .onboarding-overlay__welcome-brand {
    animation: onboarding-welcome-rise 0.55s ease both;
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
  .onboarding-overlay__card,
  .onboarding-overlay__card--welcome::before,
  .onboarding-overlay__welcome-brand,
  .onboarding-overlay__highlight-card {
    animation: none;
    transition-duration: 1ms;
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
    height: auto;
    min-height: min(23.75rem, calc(100dvh - (var(--space-4) * 2)));
    max-height: calc(100dvh - (var(--space-4) * 2));
    overflow-y: auto;
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

  .onboarding-overlay__meta {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    row-gap: 0.75rem;
  }

  .onboarding-overlay__progress {
    grid-column: 1;
    grid-row: 2;
    width: 100%;
    justify-content: center;
  }

  .onboarding-overlay__actions {
    grid-column: 1;
    grid-row: 3;
  }

  .onboarding-overlay__actions .button {
    width: 100%;
    flex: 1 1 12rem;
    text-align: center;
  }

  .onboarding-overlay__skip {
    grid-column: 1;
    grid-row: 1;
    width: auto;
    justify-self: end;
    text-align: right;
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
