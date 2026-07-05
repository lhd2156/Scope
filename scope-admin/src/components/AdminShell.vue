<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { navItems } from '@/utils/constants';
import { initTheme, setTheme, type AdminTheme } from '@/utils/theme';
import { useAuthStore } from '@/stores/authStore';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const logoSrc = `${import.meta.env.BASE_URL}scope-logomark.svg`;
const theme = ref<AdminTheme>(initTheme());
const pageTitle = computed(() => (route.meta?.title as string | undefined) ?? 'Scope operations');

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  setTheme(theme.value);
}

function logout() {
  auth.logout();
  void router.replace('/login');
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <RouterLink class="brand" to="/dashboard" aria-label="Scope Admin dashboard">
        <span class="brand-mark"><img :src="logoSrc" alt="" /></span>
        <span>
          <strong>Scope</strong>
          <small>Admin</small>
        </span>
      </RouterLink>

      <nav class="nav-list" aria-label="Admin navigation">
        <RouterLink v-for="item in navItems" :key="item.path" class="nav-link" :to="item.path">
          <span class="nav-glyph">{{ item.glyph }}</span>
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <main class="admin-main">
      <header class="admin-header">
        <div>
          <p class="eyebrow">Control plane</p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="header-actions">
          <span>{{ auth.currentUser?.email ?? 'admin session' }}</span>
          <button
            type="button"
            class="btn secondary"
            :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`"
            @click="toggleTheme"
          >
            {{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}
          </button>
          <button type="button" class="btn secondary" @click="logout">Log out</button>
        </div>
      </header>

      <RouterView v-slot="{ Component }">
        <div :key="route.path" class="page-enter">
          <component :is="Component" />
        </div>
      </RouterView>
    </main>
  </div>
</template>
