<template>
  <Transition name="cookie-consent-banner">
    <section
      v-if="consent === 'unknown'"
      class="cookie-consent-banner"
      data-test="cookie-consent-banner"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-copy"
      role="region"
    >
      <div class="cookie-consent-banner__copy">
        <p class="eyebrow">Privacy choices</p>
        <h2 id="cookie-consent-title">Choose how Scope uses optional analytics cookies</h2>
        <p id="cookie-consent-copy">
          Scope always uses essential storage for sign-in, theme, onboarding, and offline reliability.
          Allow optional analytics cookies only if you want us to measure page usage, map interactions,
          AI chats, and planning flows to improve the experience and train future Scope AI planning.
          You can change this later in Settings.
        </p>
      </div>

      <div class="cookie-consent-banner__actions">
        <Button
          type="button"
          variant="secondary"
          data-test="cookie-consent-decline"
          @click="declineAnalyticsCookies"
        >
          Only necessary
        </Button>
        <Button
          type="button"
          variant="primary"
          data-test="cookie-consent-accept"
          @click="acceptAnalyticsCookies"
        >
          Allow analytics
        </Button>
      </div>
    </section>
  </Transition>
</template>

<script setup lang="ts">
import Button from '@/components/common/Button.vue';
import { useAnalyticsConsent } from '@/utils/analyticsConsent';

const { consent, setAnalyticsConsent } = useAnalyticsConsent();

function acceptAnalyticsCookies(): void {
  setAnalyticsConsent('granted');
}

function declineAnalyticsCookies(): void {
  setAnalyticsConsent('denied');
}
</script>

<style scoped>
.cookie-consent-banner {
  position: fixed;
  inset: auto calc(var(--shell-side-padding) + var(--safe-area-right)) calc(var(--space-4) + var(--safe-area-bottom)) calc(var(--shell-side-padding) + var(--safe-area-left));
  z-index: var(--z-modal-backdrop);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-5);
  align-items: end;
  padding: var(--space-5) var(--space-6);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: 0 18px 48px -20px rgba(0, 0, 0, 0.55), 0 8px 20px -12px rgba(0, 0, 0, 0.35);
}

:root[data-theme='light'] .cookie-consent-banner {
  background: var(--bg-elevated);
  box-shadow: 0 20px 50px -24px rgba(15, 23, 42, 0.22), 0 8px 20px -14px rgba(15, 23, 42, 0.14);
}

.cookie-consent-banner__copy {
  display: grid;
  gap: var(--space-3);
}

.cookie-consent-banner__copy h2 {
  margin: 0;
  font-size: clamp(1.15rem, 2vw, 1.5rem);
  line-height: var(--line-height-tight);
}

.cookie-consent-banner__copy p {
  margin: 0;
}

.cookie-consent-banner__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
}

.cookie-consent-banner__actions :deep(.scope-button) {
  min-width: 10rem;
}

.cookie-consent-banner-enter-active,
.cookie-consent-banner-leave-active {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal);
}

.cookie-consent-banner-enter-from,
.cookie-consent-banner-leave-to {
  opacity: 0;
  transform: translateY(var(--space-4));
}

@media (max-width: 1024px) {
  .cookie-consent-banner {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }

  .cookie-consent-banner__actions {
    justify-content: stretch;
  }

  .cookie-consent-banner__actions :deep(.scope-button) {
    flex: 1 1 12rem;
  }
}

@media (max-width: 640px) {
  .cookie-consent-banner {
    inset: auto var(--space-3) calc(var(--space-3) + var(--safe-area-bottom)) var(--space-3);
    padding: var(--space-4);
    gap: var(--space-4);
  }

  .cookie-consent-banner__actions {
    flex-direction: column-reverse;
  }

  .cookie-consent-banner__actions :deep(.scope-button) {
    width: 100%;
    min-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cookie-consent-banner-enter-active,
  .cookie-consent-banner-leave-active {
    transition: none;
  }
}
</style>
