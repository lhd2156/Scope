import { computed, readonly, ref } from 'vue';
import { analyticsService, type AnalyticsConsentState } from '@/services/analyticsService';

export const ANALYTICS_CONSENT_STORAGE_KEY = 'scope-analytics-consent';

const analyticsConsent = ref<AnalyticsConsentState>('unknown');
const analyticsConsentInitialized = ref(false);

function isPersistedAnalyticsConsent(value: string | null): value is Exclude<AnalyticsConsentState, 'unknown'> {
  return value === 'granted' || value === 'denied';
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readStoredAnalyticsConsent(): AnalyticsConsentState {
  if (!canUseStorage()) {
    return 'unknown';
  }

  const storedValue = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
  return isPersistedAnalyticsConsent(storedValue) ? storedValue : 'unknown';
}

function persistAnalyticsConsent(consent: AnalyticsConsentState): void {
  if (!canUseStorage()) {
    return;
  }

  if (consent === 'unknown') {
    window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
}

function applyAnalyticsConsent(consent: AnalyticsConsentState, persist = true): AnalyticsConsentState {
  analyticsConsent.value = consent;
  analyticsService.setConsent(consent);

  if (persist) {
    persistAnalyticsConsent(consent);
  }

  return consent;
}

export function initializeAnalyticsConsent(): AnalyticsConsentState {
  if (analyticsConsentInitialized.value) {
    return analyticsConsent.value;
  }

  analyticsConsentInitialized.value = true;
  return applyAnalyticsConsent(readStoredAnalyticsConsent(), false);
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsentState, 'unknown'>): AnalyticsConsentState {
  analyticsConsentInitialized.value = true;
  return applyAnalyticsConsent(consent);
}

export function resetAnalyticsConsent(): AnalyticsConsentState {
  analyticsConsentInitialized.value = true;
  return applyAnalyticsConsent('unknown');
}

export function useAnalyticsConsent() {
  return {
    consent: readonly(analyticsConsent),
    hasAnalyticsConsentChoice: computed(() => analyticsConsent.value !== 'unknown'),
    isAnalyticsConsentInitialized: readonly(analyticsConsentInitialized),
    initializeAnalyticsConsent,
    setAnalyticsConsent,
    resetAnalyticsConsent,
  };
}
