<template>
  <main
    v-bind="stageAttrs"
    class="auth-stage"
    :class="stageClass"
  >
    <div class="auth-stage__hero">
      <LazyImage class="auth-stage__hero-image" :src="heroImageSrc" :alt="heroImageAlt" eager />
      <div class="auth-stage__hero-overlay" aria-hidden="true" />

      <div class="auth-stage__hero-content">
        <RouterLink class="auth-stage__brand" to="/" aria-label="Scope home">
          <span class="auth-stage__brand-mark">
            <img class="auth-stage__brand-mark-image" :src="SCOPE_TRIPS_LOGO_MARK_SRC" alt="" />
          </span>
          <span class="auth-stage__brand-copy">
            <strong>Scope Trips</strong>
            <small>Real trips, mapped</small>
          </span>
        </RouterLink>

        <div class="auth-stage__hero-copy">
          <p class="eyebrow">{{ heroEyebrow }}</p>
          <h1>{{ heroTitle }}</h1>
          <p>{{ heroDescription }}</p>
        </div>

        <div v-if="heroHighlights.length && !isScopeQaAuditMode" class="auth-stage__hero-highlights" aria-label="Scope membership highlights">
          <span v-for="highlight in heroHighlights" :key="highlight" class="auth-stage__highlight">
            {{ highlight }}
          </span>
        </div>
      </div>
    </div>

    <div class="auth-stage__panel-side">
      <div v-if="!isScopeQaAuditMode && showPanelEffects" class="auth-stage__particle-layer" aria-hidden="true">
        <span
          v-for="particle in ambientParticles"
          :key="particle"
          class="auth-stage__particle"
          :class="`is-${particle}`"
        />
      </div>

      <div class="auth-stage__panel-shell">
        <slot />
      </div>
    </div>
  </main>

  <AppFooter />
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { RouterLink } from 'vue-router';
import AppFooter from '@/components/common/AppFooter.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import { isScopeQaMode as resolveScopeQaMode } from '@/utils/qaMode';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    heroImageSrc: string;
    heroImageAlt?: string;
    heroEyebrow: string;
    heroTitle: string;
    heroDescription: string;
    heroHighlights?: string[];
    showPanelEffects?: boolean;
  }>(),
  {
    heroImageAlt: '',
    heroHighlights: () => [],
    showPanelEffects: true,
  },
);

const attrs = useAttrs();
const ambientParticles = ['north', 'east', 'center', 'south', 'west'] as const;
const SCOPE_TRIPS_LOGO_MARK_SRC = '/branding/scope-trips-logo-mark.png';
const isScopeQaAuditMode = resolveScopeQaMode();
const stageAttrs = computed(() => {
  const rest = { ...attrs };
  delete rest.class;
  return rest;
});
const stageClass = computed(() => [
  attrs.class,
  {
    'is-scope-qa': isScopeQaAuditMode,
    'has-panel-effects': props.showPanelEffects,
  },
]);
</script>

<style scoped>
.auth-stage {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 38%),
    linear-gradient(135deg, color-mix(in srgb, var(--bg-tertiary) 74%, var(--bg-primary)), var(--bg-primary));
}

.auth-stage__hero,
.auth-stage__panel-side {
  position: relative;
  min-height: 100vh;
  contain: layout paint;
}

.auth-stage__hero {
  overflow: hidden;
  isolation: isolate;
}

.auth-stage__hero-image,
.auth-stage__hero-overlay {
  position: absolute;
  inset: 0;
}

.auth-stage__hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.auth-stage__hero-overlay {
  background: color-mix(in srgb, var(--bg-primary) 68%, transparent);
}

.auth-stage__hero-content {
  position: relative;
  z-index: 1;
  height: 100%;
  display: grid;
  align-content: space-between;
  gap: clamp(var(--space-8), 5vw, var(--space-12));
  /*
   * Tighter top/left padding lets the Scope brand pill sit closer to the
   * corner of the hero so the landing reads like a branded poster. The
   * bottom padding keeps the hero copy + highlight chips away from the
   * screen edge.
   */
  /*
   * Slightly more inset on the left/bottom keeps hero copy off the bezel
   * without undoing the tight top/left brand placement.
   */
  padding:
    clamp(var(--space-3), 2vw, var(--space-6))
    clamp(var(--space-8), 5vw, var(--space-12))
    clamp(var(--space-6), 4.5vw, var(--space-12))
    clamp(var(--space-5), 3vw, var(--space-8));
}

.auth-stage__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  width: fit-content;
  padding: 0.9rem 1.2rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 92%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 84%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  color: var(--text-primary);
  text-decoration: none;
  box-shadow: var(--shadow-md);
}

.auth-stage__brand-mark {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 20%, transparent),
    0 0 22px color-mix(in srgb, var(--accent-teal) 16%, transparent);
  overflow: hidden;
}

.auth-stage__brand-mark-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.auth-stage__brand-copy {
  display: grid;
  gap: 0.15rem;
}

.auth-stage__brand-copy strong,
.auth-stage__brand-copy small,
.auth-stage__hero-copy h1,
.auth-stage__hero-copy p,
.eyebrow,
.auth-stage__highlight {
  margin: 0;
}

.auth-stage__brand-copy strong {
  font-size: 1.2rem;
  line-height: 1;
}

.auth-stage__brand-copy small {
  color: color-mix(in srgb, var(--text-primary) 68%, var(--text-secondary));
  font-size: var(--font-size-small);
}

.auth-stage__hero-copy {
  display: grid;
  gap: var(--space-4);
  max-width: 34rem;
  margin-top: auto;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.auth-stage__hero-copy h1 {
  font-size: var(--font-size-hero);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
  max-width: 11ch;
}

.auth-stage__hero-copy p {
  max-width: 32rem;
  color: color-mix(in srgb, var(--text-primary) 78%, var(--text-secondary));
  font-size: 1.05rem;
  line-height: var(--line-height-normal);
}

.auth-stage__hero-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.auth-stage__highlight {
  padding: 0.85rem 1rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 80%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-sm);
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.auth-stage__panel-side {
  display: grid;
  place-items: center;
  /*
   * Generous inline padding so the form card never hugs the viewport edge;
   * block padding keeps the stack vertically centered with room above/below.
   * safe-area insets are layered on for notched / home-indicator devices.
   */
  padding-block-start: max(
    clamp(var(--space-6), 4.5vw, var(--space-12)),
    env(safe-area-inset-top, 0px)
  );
  padding-block-end: max(
    clamp(var(--space-6), 4.5vw, var(--space-12)),
    env(safe-area-inset-bottom, 0px)
  );
  padding-left: max(
    clamp(var(--space-8), 6vw, var(--space-16)),
    env(safe-area-inset-left, 0px)
  );
  padding-right: max(
    clamp(var(--space-8), 6vw, var(--space-16)),
    env(safe-area-inset-right, 0px)
  );
  overflow: hidden;
  isolation: isolate;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 94%, transparent), color-mix(in srgb, var(--bg-primary) 99%, transparent)),
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 42%),
    radial-gradient(circle at bottom right, color-mix(in srgb, var(--accent-gold) 10%, transparent), transparent 32%);
}

.auth-stage__panel-side::before,
.auth-stage.has-panel-effects .auth-stage__panel-side::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

.auth-stage__panel-side::before {
  inset: -10%;
  background:
    linear-gradient(color-mix(in srgb, var(--glass-border) 70%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--glass-border) 70%, transparent) 1px, transparent 1px);
  background-size: 4.6rem 4.6rem;
  mask-image: radial-gradient(circle at center, black 42%, transparent 90%);
  opacity: 0.7;
}

.auth-stage.has-panel-effects .auth-stage__panel-side::after {
  top: -8rem;
  right: -9rem;
  width: 26rem;
  aspect-ratio: 1;
  border-radius: var(--radius-full);
  background: radial-gradient(circle, color-mix(in srgb, var(--accent-teal) 30%, transparent), transparent 72%);
  filter: blur(14px);
  opacity: 0.9;
}

.auth-stage__particle-layer,
.auth-stage__panel-shell {
  position: relative;
  z-index: 1;
}

.auth-stage__particle-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.auth-stage__particle {
  position: absolute;
  width: 0.6rem;
  aspect-ratio: 1;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 72%, var(--text-primary));
  box-shadow: 0 0 1rem color-mix(in srgb, var(--accent-teal) 36%, transparent);
  opacity: 0.85;
}

.auth-stage__particle.is-north {
  top: 16%;
  left: 20%;
}

.auth-stage__particle.is-east {
  top: 28%;
  right: 18%;
}

.auth-stage__particle.is-center {
  top: 48%;
  left: 58%;
  width: 0.85rem;
}

.auth-stage__particle.is-south {
  right: 26%;
  bottom: 18%;
  background: color-mix(in srgb, var(--accent-gold) 62%, var(--text-primary));
  box-shadow: 0 0 1rem color-mix(in srgb, var(--accent-gold) 26%, transparent);
}

.auth-stage__particle.is-west {
  bottom: 28%;
  left: 14%;
}

.auth-stage__panel-shell {
  width: 100%;
  max-width: 46rem;
  contain: layout paint style;
}

.auth-stage.is-scope-qa {
  background: linear-gradient(135deg, color-mix(in srgb, var(--bg-tertiary) 76%, var(--bg-primary)), var(--bg-primary));
}

.auth-stage.is-scope-qa .auth-stage__hero,
.auth-stage.is-scope-qa .auth-stage__panel-side {
  min-height: auto;
}

.auth-stage.is-scope-qa .auth-stage__hero {
  background: var(--bg-secondary);
}

.auth-stage.is-scope-qa .auth-stage__hero-content {
  align-content: center;
}

.auth-stage.is-scope-qa .auth-stage__panel-side {
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 98%, transparent), var(--bg-primary));
}

.auth-stage.is-scope-qa .auth-stage__panel-side::before,
.auth-stage.is-scope-qa .auth-stage__panel-side::after {
  content: none;
}

@keyframes auth-fade-up {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes auth-drift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(0.35rem, -0.75rem, 0) scale(1.08);
  }
}

@keyframes auth-orb-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.85;
  }

  50% {
    transform: scale(1.08);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .auth-stage__brand,
  .auth-stage__hero-copy,
  .auth-stage__hero-highlights,
  .auth-stage__panel-shell {
    animation: auth-fade-up 0.7s ease both;
  }

  .auth-stage__hero-copy {
    animation-delay: 80ms;
  }

  .auth-stage__hero-highlights,
  .auth-stage__panel-shell {
    animation-delay: 140ms;
  }

  .auth-stage__panel-side::after {
    animation: auth-orb-pulse 12s ease-in-out infinite;
  }

  .auth-stage__particle {
    animation: auth-drift 9s ease-in-out infinite;
  }

  .auth-stage__particle.is-east {
    animation-delay: 1.3s;
  }

  .auth-stage__particle.is-center {
    animation-delay: 2.1s;
  }

  .auth-stage__particle.is-south {
    animation-delay: 0.8s;
  }

  .auth-stage__particle.is-west {
    animation-delay: 2.8s;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-stage__brand,
  .auth-stage__hero-copy,
  .auth-stage__hero-highlights,
  .auth-stage__panel-shell,
  .auth-stage__particle,
  .auth-stage__panel-side::after {
    animation: none;
  }
}

/*
 * Split auth (wide screens): the auth surface stays one viewport tall and
 * the standard site footer follows below it, matching the rest of Scope.
 */
@media (min-width: 1025px) {
  .auth-stage:not(.is-scope-qa) {
    height: 100dvh;
    max-height: 100dvh;
    min-height: 0;
    overflow: hidden;
    grid-template-rows: minmax(0, 1fr);
  }

  .auth-stage:not(.is-scope-qa) .auth-stage__hero,
  .auth-stage:not(.is-scope-qa) .auth-stage__panel-side {
    min-height: 0;
    max-height: 100%;
  }

  .auth-stage:not(.is-scope-qa) .auth-stage__hero {
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .auth-stage:not(.is-scope-qa) .auth-stage__hero-content {
    min-height: 0;
    max-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .auth-stage:not(.is-scope-qa) .auth-stage__panel-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
    height: 100%;
    box-sizing: border-box;
    padding-block-start: max(
      clamp(var(--space-3), 2vh, var(--space-6)),
      env(safe-area-inset-top, 0px)
    );
    padding-block-end: max(
      clamp(var(--space-3), 2vh, var(--space-6)),
      env(safe-area-inset-bottom, 0px)
    );
  }

  .auth-stage:not(.is-scope-qa) .auth-stage__panel-shell {
    /* Scrolling the form slot: avoid strict containment on the default rule. */
    contain: none;
    flex: 0 1 auto;
    min-height: 0;
    max-height: 100%;
    width: 100%;
    display: block;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .auth-stage:not(.is-scope-qa) .auth-stage__panel-shell::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
}

@media (max-width: 1024px) {
  .auth-stage {
    grid-template-columns: 1fr;
  }

  .auth-stage__hero,
  .auth-stage__panel-side {
    min-height: auto;
  }

  .auth-stage__hero {
    min-height: 20rem;
  }

  .auth-stage__hero-content {
    gap: var(--space-6);
    padding: clamp(var(--space-5), 4vw, var(--space-8));
  }

  .auth-stage__hero-copy h1 {
    max-width: 14ch;
    font-size: clamp(2.25rem, 6vw, 3rem);
  }

  .auth-stage__hero-copy p {
    font-size: 1rem;
  }

  .auth-stage__highlight {
    padding: 0.6rem 0.9rem;
    font-size: 0.8rem;
  }

  .auth-stage__panel-shell {
    max-width: 34rem;
  }
}

@media (max-width: 680px) {
  .auth-stage__hero {
    min-height: 17rem;
  }

  .auth-stage__hero-content {
    padding: var(--space-5);
  }

  .auth-stage__panel-side {
    padding-block-start: max(var(--space-6), env(safe-area-inset-top, 0px));
    padding-block-end: max(var(--space-6), env(safe-area-inset-bottom, 0px));
    padding-left: max(var(--space-5), env(safe-area-inset-left, 0px));
    padding-right: max(var(--space-5), env(safe-area-inset-right, 0px));
  }

  .auth-stage__brand {
    padding-inline: 1rem;
  }

  .auth-stage__brand-mark {
    width: 2.25rem;
    height: 2.25rem;
  }

  .auth-stage__brand-copy strong {
    font-size: 1.05rem;
  }

  .auth-stage__hero-copy h1 {
    font-size: clamp(1.9rem, 8vw, 2.5rem);
    max-width: 16ch;
  }

  .auth-stage__hero-highlights {
    gap: var(--space-2);
  }

  .auth-stage__highlight {
    padding: 0.5rem 0.85rem;
  }
}
</style>
