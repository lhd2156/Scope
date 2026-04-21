<template>
  <RouterView v-slot="{ Component, route: activeRoute }">
    <Transition :name="routeTransitionName" mode="out-in">
      <div
        :key="resolveRouteStageKey(activeRoute)"
        class="route-stage"
        :data-route-name="resolveRouteStageName(activeRoute)"
        :data-route-path="activeRoute.path"
      >
        <AppErrorBoundary :reset-key="resolveRouteBoundaryKey(activeRoute)">
          <component :is="Component" />
        </AppErrorBoundary>
      </div>
    </Transition>
  </RouterView>

  <AuthSessionRuntime v-if="shouldBootAuthenticatedSession" />
  <OnboardingOverlay v-if="shouldRenderOnboarding" />
  <CookieConsentBanner v-if="shouldRenderCookieConsent" />
  <ToastViewport v-if="toastStore.hasToasts" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute, type RouteLocationNormalizedLoaded } from 'vue-router';
import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue';
import { useOnboardingStore } from '@/stores/onboarding';
import { useToastStore } from '@/stores/toasts';
import { AUTH_SESSION_HINT_CHANGE_EVENT, hasStoredAuthSessionHint } from '@/utils/authSessionStorage';
import { useReducedMotion } from '@/utils/motion';
import { isAtlasQaMode, syncAtlasQaDocumentState } from '@/utils/qaMode';

const ANALYTICS_CONSENT_STORAGE_KEY = 'atlas-analytics-consent';

function hasAnalyticsConsentChoice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const storedValue = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return storedValue === 'granted' || storedValue === 'denied';
  } catch {
    return false;
  }
}

const AuthSessionRuntime = defineAsyncComponent(() => import('@/components/common/AuthSessionRuntime.vue'));
const CookieConsentBanner = defineAsyncComponent(() => import('@/components/common/CookieConsentBanner.vue'));
const OnboardingOverlay = defineAsyncComponent(() => import('@/components/common/OnboardingOverlay.vue'));
const ToastViewport = defineAsyncComponent(() => import('@/components/common/ToastViewport.vue'));

const onboardingStore = useOnboardingStore();
const toastStore = useToastStore();
const reducedMotion = useReducedMotion();
const route = useRoute();
const hasSessionHint = ref(hasStoredAuthSessionHint());

const routeTransitionName = computed(() => (reducedMotion.value ? 'route-fade-reduced' : 'route-fade'));
const shouldBootAuthenticatedSession = computed(() => Boolean(route.meta.requiresAuth) || hasSessionHint.value);
const shouldRenderOnboarding = computed(() => !isAtlasQaMode(route.fullPath) && onboardingStore.isActive);
const shouldRenderCookieConsent = computed(() => !isAtlasQaMode(route.fullPath) && !hasAnalyticsConsentChoice());

function syncSessionHint(): void {
  hasSessionHint.value = hasStoredAuthSessionHint();
}

function resolveRouteStageKey(activeRoute: RouteLocationNormalizedLoaded): string {
  return activeRoute.path;
}

function resolveRouteBoundaryKey(activeRoute: RouteLocationNormalizedLoaded): string {
  return activeRoute.fullPath;
}

function resolveRouteStageName(activeRoute: RouteLocationNormalizedLoaded): string {
  return typeof activeRoute.name === 'string' ? activeRoute.name : activeRoute.path;
}

watch(
  () => route.fullPath,
  (nextRoute) => {
    syncAtlasQaDocumentState(nextRoute);
  },
  { immediate: true },
);

onMounted(() => {
  if (typeof window === 'undefined') {
    return;
  }

  syncSessionHint();
  window.addEventListener(AUTH_SESSION_HINT_CHANGE_EVENT, syncSessionHint);
  window.addEventListener('storage', syncSessionHint);
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') {
    return;
  }

  window.removeEventListener(AUTH_SESSION_HINT_CHANGE_EVENT, syncSessionHint);
  window.removeEventListener('storage', syncSessionHint);
});
</script>
