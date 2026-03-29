<template>
  <header class="navbar glass-panel">
    <RouterLink to="/" class="brand">
      <AtlasIcon name="logo" />
      <span>Atlas</span>
    </RouterLink>

    <nav class="nav-links" aria-label="Primary">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/explore">Explore</RouterLink>
      <RouterLink to="/map">Map</RouterLink>
      <RouterLink to="/trips/new">Trips</RouterLink>
      <RouterLink to="/friends">Friends</RouterLink>
    </nav>

    <div class="actions">
      <SearchBar
        v-model="searchQuery"
        class="navbar-search"
        compact
        label="Search Atlas"
        placeholder="Search cities, vibes, and spots"
        @search="handleSearch"
      />

      <NotificationDropdown
        v-if="authStore.isAuthenticated"
        :notifications="notificationsStore.items.slice(0, 4)"
        :unread-count="notificationsStore.unreadCount"
        :loading="notificationsStore.loading"
        :connection-state="notificationsStore.connectionState"
        :connection-error="notificationsStore.connectionError"
        @mark-all-read="notificationsStore.markAllRead"
        @read="notificationsStore.markRead"
      />

      <ThemeToggle />

      <div v-if="authStore.currentUser" ref="menuRef" class="menu-shell">
        <button type="button" class="profile-chip" :aria-expanded="String(isMenuOpen)" @click="isMenuOpen = !isMenuOpen">
          <Avatar :name="authStore.currentUser.displayName" :src="authStore.currentUser.avatarUrl" :size="36" />
          <span>{{ authStore.currentUser.displayName }}</span>
          <AtlasIcon name="chevron-down" label="Open user menu" />
        </button>

        <Transition name="dropdown-fade">
          <div v-if="isMenuOpen" class="menu-dropdown surface-card">
            <RouterLink :to="`/profile/${authStore.currentUser.id}`" @click="closeMenu">
              <AtlasIcon name="user" label="Profile" />
              <span>Profile</span>
            </RouterLink>
            <RouterLink to="/settings" @click="closeMenu">
              <AtlasIcon name="settings" label="Settings" />
              <span>Settings</span>
            </RouterLink>
            <button type="button" @click="handleLogout">
              <AtlasIcon name="logout" label="Log out" />
              <span>Log out</span>
            </button>
          </div>
        </Transition>
      </div>

      <div v-else class="guest-actions">
        <RouterLink class="ghost-link" to="/login">Log in</RouterLink>
        <RouterLink class="accent-link" to="/register">Create account</RouterLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core';
import { ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Avatar from '@/components/common/Avatar.vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import SearchBar from '@/components/common/SearchBar.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import NotificationDropdown from '@/components/social/NotificationDropdown.vue';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
import { useToastStore } from '@/stores/toasts';

const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();
const toastStore = useToastStore();
const route = useRoute();
const router = useRouter();
const searchQuery = ref('');
const isMenuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);

function syncSearchFromRoute() {
  searchQuery.value = typeof route.query.q === 'string' ? route.query.q : '';
}

function closeMenu() {
  isMenuOpen.value = false;
}

async function handleLogout() {
  await authStore.logout();
  closeMenu();
  await router.push({ name: 'home' });

  if (authStore.error) {
    toastStore.showInfo({
      title: 'Signed out locally',
      message: authStore.error,
    });
    return;
  }

  toastStore.showSuccess({
    title: 'Signed out',
    message: 'Your Atlas session is closed for now. Come back anytime to keep exploring.',
  });
}

function handleSearch(query: string) {
  const normalizedQuery = query.trim();
  void router.push({
    name: 'explore',
    query: normalizedQuery ? { q: normalizedQuery } : {},
  });
}

watch(
  () => route.fullPath,
  () => {
    syncSearchFromRoute();
    closeMenu();
  },
  { immediate: true },
);

onClickOutside(menuRef, closeMenu);
</script>

<style scoped>
.navbar {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  width: min(var(--page-max-width), calc(100vw - (var(--shell-side-padding) * 2)));
  z-index: var(--z-navbar);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(16rem, auto);
  grid-template-areas: 'brand nav actions';
  align-items: center;
  gap: var(--space-4);
  padding: 1rem clamp(1rem, 2vw, 1.25rem);
}

.brand,
.nav-links,
.actions,
.profile-chip,
.guest-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.brand {
  grid-area: brand;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-h3);
}

.brand :deep(svg) {
  color: var(--accent-teal);
}

.nav-links {
  grid-area: nav;
  justify-content: center;
  flex-wrap: wrap;
  gap: clamp(var(--space-3), 1.5vw, var(--space-5));
}

.nav-links a,
.ghost-link,
.profile-chip {
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.nav-links a.router-link-active,
.nav-links a:hover,
.nav-links a:focus-visible,
.ghost-link:hover,
.ghost-link:focus-visible,
.profile-chip:hover,
.profile-chip:focus-visible {
  color: var(--text-primary);
  outline: none;
}

.actions {
  grid-area: actions;
  justify-content: flex-end;
  justify-self: end;
  min-width: 0;
}

.navbar-search {
  min-width: min(18rem, 34vw);
}

.navbar-search :deep(.search-bar__label) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.menu-shell {
  position: relative;
}

.profile-chip {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  padding: 0.35rem 0.45rem;
  cursor: pointer;
}

.profile-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-chip :deep(.atlas-icon:last-child) {
  width: 0.85rem;
  height: 0.85rem;
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  min-width: 12rem;
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  z-index: var(--z-dropdown);
}

.menu-dropdown a,
.menu-dropdown button {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 0.8rem 0.9rem;
  border: 0;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.menu-dropdown a:hover,
.menu-dropdown a:focus-visible,
.menu-dropdown button:hover,
.menu-dropdown button:focus-visible {
  background: var(--accent-teal-light);
  outline: none;
}

.guest-actions {
  flex-wrap: nowrap;
}

.accent-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  color: var(--bg-primary);
  padding: 0.75rem 0.95rem;
  font-weight: var(--font-weight-semibold);
}

.accent-link:hover,
.accent-link:focus-visible {
  background: var(--accent-teal-hover);
  outline: none;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem);
}

@media (max-width: 1260px) {
  .navbar {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'brand actions'
      'nav nav';
    row-gap: var(--space-3);
  }

  .nav-links {
    width: 100%;
    justify-content: flex-start;
    padding-top: var(--space-2);
    border-top: 1px solid var(--glass-border);
  }
}

@media (max-width: 960px) {
  .actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .navbar-search {
    flex: 1 1 100%;
    min-width: 100%;
  }
}

@media (max-width: 760px) {
  .navbar {
    grid-template-columns: 1fr;
    grid-template-areas:
      'brand'
      'actions'
      'nav';
    justify-items: stretch;
  }

  .nav-links,
  .actions,
  .guest-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .actions {
    justify-content: space-between;
  }

  .profile-chip {
    width: fit-content;
  }

  .profile-chip span {
    display: none;
  }
}
</style>
