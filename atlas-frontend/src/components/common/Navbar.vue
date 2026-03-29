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
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  width: min(var(--page-max-width), calc(100vw - (var(--shell-side-padding) * 2)));
  z-index: var(--z-navbar);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
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

.profile-chip {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  padding: 0.35rem 0.45rem;
}

.profile-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

@media (max-width: 1120px) {
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
