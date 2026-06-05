<template>
  <div class="layout-shell" :data-navbar="navbarVariant">
    <component :is="activeNavbar" />
    <main><slot /></main>
    <AppFooter v-if="!hideFooter" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { AUTH_SESSION_HINT_CHANGE_EVENT, hasStoredAuthSessionHint } from '@/utils/authSessionStorage';
import { getScopeQaSession } from '@/utils/qaMode';

defineProps<{
  hideFooter?: boolean;
}>();

const Navbar = defineAsyncComponent(() => import('./Navbar.vue'));
const GuestNavbar = defineAsyncComponent(() => import('./GuestNavbar.vue'));
const AppFooter = defineAsyncComponent(() => import('./AppFooter.vue'));

const route = useRoute();
const hasSessionHint = ref(hasStoredAuthSessionHint());
const qaSession = computed(() => getScopeQaSession(route.fullPath));
const isGuest = computed(() =>
  qaSession.value === 'guest' || (!route.meta.requiresAuth && !hasSessionHint.value && qaSession.value !== 'authenticated'),
);
const activeNavbar = computed(() => (isGuest.value ? GuestNavbar : Navbar));
const navbarVariant = computed(() => (isGuest.value ? 'guest' : 'auth'));

function syncSessionHint(): void {
  hasSessionHint.value = hasStoredAuthSessionHint();
}

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

<style scoped>
/*
  The guest navbar is ~4rem tall; give the content a breathing gap
  below it so pages feel intentional instead of pressed against the bar.
*/
.layout-shell[data-navbar='guest'] {
  --shell-content-top-base: 6rem;
  --shell-content-top: calc(6rem + var(--safe-area-top, 0px));
}

@media (max-width: 640px) {
  .layout-shell[data-navbar='guest'] {
    --shell-content-top-base: 5rem;
    --shell-content-top: calc(5rem + var(--safe-area-top, 0px));
  }
}
</style>
