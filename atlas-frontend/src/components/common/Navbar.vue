<template>
  <header class="navbar glass-panel">
    <RouterLink to="/" class="brand">
      <AtlasIcon name="logo" />
      <span>Atlas</span>
    </RouterLink>

    <nav class="nav-links" aria-label="Primary">
      <RouterLink to="/explore">Explore</RouterLink>
      <RouterLink to="/map">Map</RouterLink>
      <RouterLink to="/trips/new">Trips</RouterLink>
      <RouterLink to="/friends">Friends</RouterLink>
    </nav>

    <div class="actions">
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
      <RouterLink v-if="authStore.currentUser" :to="`/profile/${authStore.currentUser.id}`" class="profile-chip">
        <Avatar :name="authStore.currentUser.displayName" :src="authStore.currentUser.avatarUrl" :size="36" />
        <span>{{ authStore.currentUser.displayName }}</span>
      </RouterLink>
      <div v-else class="guest-actions">
        <RouterLink class="ghost-link" to="/login">Log in</RouterLink>
        <RouterLink class="accent-link" to="/register">Create account</RouterLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import Avatar from '@/components/common/Avatar.vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import NotificationDropdown from '@/components/social/NotificationDropdown.vue';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';

const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();
</script>

<style scoped>
.navbar {
  position: fixed;
  inset: 1rem 1rem auto;
  z-index: var(--z-navbar);
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-4);
  padding: 1rem 1.25rem;
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
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-h3);
}

.brand :deep(svg) {
  color: var(--accent-teal);
}

.nav-links {
  justify-content: center;
  flex-wrap: wrap;
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
  justify-content: flex-end;
}

.profile-chip {
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  padding: 0.35rem 0.45rem;
}

.guest-actions {
  flex-wrap: wrap;
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

@media (max-width: 1024px) {
  .navbar {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .nav-links,
  .actions {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 720px) {
  .nav-links,
  .actions,
  .guest-actions {
    flex-wrap: wrap;
  }

  .profile-chip span {
    display: none;
  }
}
</style>
