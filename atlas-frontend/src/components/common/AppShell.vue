<template>
  <div class="layout-shell">
    <component :is="activeNavbar" />
    <main><slot /></main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { AUTH_SESSION_HINT_CHANGE_EVENT, hasStoredAuthSessionHint } from '@/utils/authSessionStorage';
import { isAtlasQaMode } from '@/utils/qaMode';

const Navbar = defineAsyncComponent(() => import('./Navbar.vue'));
const GuestNavbar = defineAsyncComponent(() => import('./GuestNavbar.vue'));

const route = useRoute();
const hasSessionHint = ref(hasStoredAuthSessionHint());
const activeNavbar = computed(() => (isAtlasQaMode() || (!route.meta.requiresAuth && !hasSessionHint.value) ? GuestNavbar : Navbar));

function syncSessionHint(): void {
  hasSessionHint.value = hasStoredAuthSessionHint();
}

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
