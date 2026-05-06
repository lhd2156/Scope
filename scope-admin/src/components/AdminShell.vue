<script setup lang="ts">
import { useRouter } from 'vue-router';
import { navItems } from '@/utils/constants';
import { useAuthStore } from '@/stores/authStore';

const auth = useAuthStore();
const router = useRouter();

function logout() {
  auth.logout();
  void router.replace('/login');
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <RouterLink class="brand" to="/dashboard" aria-label="Scope Admin dashboard">
        <span class="brand-mark">AT</span>
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
          <h1>Scope operations</h1>
        </div>
        <div class="header-actions">
          <span>{{ auth.currentUser?.email ?? 'admin session' }}</span>
          <button type="button" class="btn secondary" @click="logout">Log out</button>
        </div>
      </header>

      <RouterView />
    </main>
  </div>
</template>
