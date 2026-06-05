<template>
  <RouterView v-slot="{ Component, route: activeRoute }">
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
  </RouterView>

  <AuthSessionRuntime v-if="shouldBootAuthenticatedSession" />
  <OnboardingOverlay v-if="shouldRenderOnboarding" />
  <CookieConsentBanner v-if="shouldRenderCookieConsent" />
  <ToastViewport v-if="toastStore.hasToasts" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute, type RouteLocationNormalizedLoaded } from 'vue-router';
import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue';
import { useOnboardingStore } from '@/stores/onboarding';
import { useToastStore } from '@/stores/toasts';
import { defineShellAsyncComponent } from '@/utils/shellAsyncComponent';
import { ANALYTICS_CONSENT_STORAGE_KEY } from '@/utils/analyticsConsent';
import { AUTH_SESSION_HINT_CHANGE_EVENT, hasStoredAuthSessionHint } from '@/utils/authSessionStorage';
import { isScopeQaMode, syncScopeQaDocumentState } from '@/utils/qaMode';

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

const AuthSessionRuntime = defineShellAsyncComponent(() => import('@/components/common/AuthSessionRuntime.vue'));
const CookieConsentBanner = defineShellAsyncComponent(() => import('@/components/common/CookieConsentBanner.vue'));
const OnboardingOverlay = defineShellAsyncComponent(() => import('@/components/common/OnboardingOverlay.vue'));
const ToastViewport = defineShellAsyncComponent(() => import('@/components/common/ToastViewport.vue'));

const onboardingStore = useOnboardingStore();
const toastStore = useToastStore();
const route = useRoute();
const hasSessionHint = ref(hasStoredAuthSessionHint());

const shouldBootAuthenticatedSession = computed(() => Boolean(route.meta.requiresAuth) || hasSessionHint.value);
const shouldRenderOnboarding = computed(() => !isScopeQaMode(route.fullPath) && onboardingStore.isActive);
const shouldRenderCookieConsent = computed(() => !isScopeQaMode(route.fullPath) && !hasAnalyticsConsentChoice());

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
    syncScopeQaDocumentState(nextRoute);
  },
  { immediate: true },
);

onMounted(() => {
  syncSessionHint();
  window.addEventListener(AUTH_SESSION_HINT_CHANGE_EVENT, syncSessionHint);
  window.addEventListener('storage', syncSessionHint);
});

onBeforeUnmount(() => {
  window.removeEventListener(AUTH_SESSION_HINT_CHANGE_EVENT, syncSessionHint);
  window.removeEventListener('storage', syncSessionHint);
});
</script>
