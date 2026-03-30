<template>
  <header class="navbar" :class="{ 'navbar--scrolled': isScrolled }">
    <div class="navbar__inner">
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

        <div v-if="authStore.currentUser" ref="menuRef" class="menu-shell" @focusout="handleMenuFocusOut">
          <button
            :id="menuButtonId"
            ref="menuButtonRef"
            type="button"
            class="profile-chip"
            aria-haspopup="menu"
            :aria-expanded="String(isMenuOpen)"
            :aria-controls="isMenuOpen ? menuId : undefined"
            @click="toggleMenu"
            @keydown="handleMenuButtonKeydown"
          >
            <span class="profile-chip__avatar-shell">
              <Avatar :name="authStore.currentUser.displayName" :src="authStore.currentUser.avatarUrl" :size="36" />
            </span>
            <span class="profile-chip__copy">
              <strong>{{ authStore.currentUser.displayName }}</strong>
              <small>{{ profileMetaLine }}</small>
            </span>
            <span class="profile-chip__chevron" aria-hidden="true">
              <AtlasIcon name="chevron-down" label="Open user menu" />
            </span>
          </button>

          <Transition name="dropdown-fade">
            <div
              v-if="isMenuOpen"
              :id="menuId"
              ref="menuPanelRef"
              class="menu-dropdown glass-panel"
              role="menu"
              :aria-labelledby="menuButtonId"
              tabindex="-1"
              @keydown="handleMenuKeydown"
            >
              <div class="menu-dropdown__profile" role="none">
                <Avatar :name="authStore.currentUser.displayName" :src="authStore.currentUser.avatarUrl" :size="48" />
                <div class="menu-dropdown__copy" role="none">
                  <p class="menu-dropdown__eyebrow">Signed in as</p>
                  <strong>{{ authStore.currentUser.displayName }}</strong>
                  <p>{{ profileMetaLine }}</p>
                </div>
              </div>

              <div class="menu-dropdown__divider" role="none" aria-hidden="true" />

              <div class="menu-dropdown__actions" role="none">
                <RouterLink :to="`/profile/${authStore.currentUser.id}`" role="menuitem" tabindex="-1" @click="closeMenu">
                  <AtlasIcon name="user" label="Profile" />
                  <span>Profile</span>
                </RouterLink>
                <RouterLink to="/settings" role="menuitem" tabindex="-1" @click="closeMenu">
                  <AtlasIcon name="settings" label="Settings" />
                  <span>Settings</span>
                </RouterLink>
                <button type="button" role="menuitem" tabindex="-1" @click="handleLogout">
                  <AtlasIcon name="logout" label="Log out" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <div v-else class="guest-actions">
          <RouterLink class="ghost-link" to="/login">Log in</RouterLink>
          <RouterLink class="accent-link" to="/register">Create account</RouterLink>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
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
const isScrolled = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const menuButtonRef = ref<HTMLElement | null>(null);
const menuPanelRef = ref<HTMLElement | null>(null);
const menuButtonId = `navbar-menu-button-${useId()}`;
const menuId = `navbar-menu-${useId()}`;
const profileMetaLine = computed(() => {
  if (!authStore.currentUser) {
    return '';
  }

  if (authStore.currentUser.homeBase) {
    return authStore.currentUser.homeBase;
  }

  if (authStore.currentUser.username) {
    return `@${authStore.currentUser.username}`;
  }

  return authStore.currentUser.email || 'Traveler profile';
});

function syncSearchFromRoute() {
  searchQuery.value = typeof route.query.q === 'string' ? route.query.q : '';
}

function updateScrollState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  isScrolled.value = window.scrollY > 24;
}

function getMenuItems(): HTMLElement[] {
  if (!menuPanelRef.value) {
    return [];
  }

  return Array.from(menuPanelRef.value.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

function focusMenuBoundary(position: 'first' | 'last'): void {
  const menuItems = getMenuItems();
  const focusTarget = position === 'first' ? menuItems[0] : menuItems[menuItems.length - 1];

  if (focusTarget) {
    focusTarget.focus();
    return;
  }

  menuPanelRef.value?.focus();
}

async function openMenu(position: 'none' | 'first' | 'last' = 'none'): Promise<void> {
  if (!isMenuOpen.value) {
    isMenuOpen.value = true;
    await nextTick();
  }

  if (position === 'first' || position === 'last') {
    focusMenuBoundary(position);
  }
}

function closeMenu(options: { restoreFocus?: boolean } = {}) {
  if (!isMenuOpen.value) {
    return;
  }

  isMenuOpen.value = false;

  if (options.restoreFocus) {
    void nextTick(() => {
      menuButtonRef.value?.focus();
    });
  }
}

function toggleMenu() {
  if (isMenuOpen.value) {
    closeMenu();
    return;
  }

  void openMenu('first');
}

function handleMenuButtonKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      void openMenu('first');
      break;
    case 'ArrowUp':
      event.preventDefault();
      void openMenu('last');
      break;
    case 'Enter':
    case ' ':
      if (!isMenuOpen.value) {
        event.preventDefault();
        void openMenu('first');
      }
      break;
    case 'Escape':
      if (isMenuOpen.value) {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      }
      break;
    default:
      break;
  }
}

function moveMenuFocus(direction: 1 | -1): void {
  const menuItems = getMenuItems();

  if (!menuItems.length) {
    menuPanelRef.value?.focus();
    return;
  }

  const activeElement = typeof document === 'undefined' ? null : document.activeElement;
  const currentIndex = menuItems.findIndex((menuItem) => menuItem === activeElement);
  const nextIndex = currentIndex === -1
    ? direction === 1 ? 0 : menuItems.length - 1
    : (currentIndex + direction + menuItems.length) % menuItems.length;

  menuItems[nextIndex]?.focus();
}

function handleMenuKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveMenuFocus(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveMenuFocus(-1);
      break;
    case 'Home':
      event.preventDefault();
      focusMenuBoundary('first');
      break;
    case 'End':
      event.preventDefault();
      focusMenuBoundary('last');
      break;
    case 'Escape':
      event.preventDefault();
      closeMenu({ restoreFocus: true });
      break;
    default:
      break;
  }
}

function handleMenuFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;

  if (nextTarget instanceof Node && menuRef.value?.contains(nextTarget)) {
    return;
  }

  closeMenu();
}

function handleGlobalMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isMenuOpen.value) {
    event.preventDefault();
    closeMenu({ restoreFocus: true });
  }
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
    updateScrollState();
  },
  { immediate: true },
);

watch(
  () => isMenuOpen.value,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', handleGlobalMenuKeydown);
      return;
    }

    window.removeEventListener('keydown', handleGlobalMenuKeydown);
  },
  { immediate: true },
);

onClickOutside(menuRef, () => {
  closeMenu();
});

onMounted(() => {
  updateScrollState();
  window.addEventListener('scroll', updateScrollState, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalMenuKeydown);
  window.removeEventListener('scroll', updateScrollState);
});
</script>

<style scoped>
.navbar {
  position: fixed;
  inset: 0 0 auto;
  z-index: var(--z-navbar);
  isolation: isolate;
  padding: 0.85rem 0 0.7rem;
  border-bottom: 1px solid color-mix(in srgb, var(--glass-border) 65%, transparent);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 72%, transparent) 0%,
      color-mix(in srgb, var(--bg-primary) 28%, transparent) 76%,
      transparent 100%
    );
  opacity: var(--motion-navbar-opacity-rest);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition:
    opacity var(--transition-normal),
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal),
    padding var(--transition-normal);
}

.navbar::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  width: min(var(--page-max-width), calc(100vw - (var(--shell-side-padding) * 2)));
  height: 1px;
  border-radius: var(--radius-full);
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--accent-teal) 42%, transparent),
    transparent
  );
  opacity: 0;
  transform: translateX(-50%) scaleX(0.92);
  transition: opacity var(--transition-normal), transform var(--transition-normal);
  pointer-events: none;
}

.navbar--scrolled {
  padding: 0.65rem 0 0.55rem;
  border-bottom-color: var(--glass-border);
  opacity: var(--motion-navbar-opacity-scrolled);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--glass-bg) 95%, transparent) 0%,
      color-mix(in srgb, var(--bg-primary) 92%, transparent) 100%
    );
  box-shadow: 0 1.5rem 3rem color-mix(in srgb, var(--bg-primary) 34%, transparent);
}

.navbar--scrolled::after {
  opacity: 1;
  transform: translateX(-50%) scaleX(1);
}

.navbar__inner {
  width: min(var(--page-max-width), calc(100vw - (var(--shell-side-padding) * 2)));
  margin: 0 auto;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(16rem, auto);
  grid-template-areas: 'brand nav actions';
  align-items: center;
  gap: var(--space-4);
  transition: transform var(--transition-normal), gap var(--transition-normal);
}

.navbar--scrolled .navbar__inner {
  transform: translateY(var(--motion-button-lift));
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
  font-size: clamp(1.2rem, 1.6vw, 1.45rem);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.04em;
}

.brand :deep(svg) {
  color: var(--accent-teal);
  filter: drop-shadow(0 0 1rem color-mix(in srgb, var(--accent-teal) 30%, transparent));
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
}

.nav-links a {
  position: relative;
  padding: 0.35rem 0;
  transition:
    color var(--transition-fast),
    transform var(--transition-fast);
}

.nav-links a::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -0.55rem;
  height: 2px;
  border-radius: var(--radius-full);
  background: linear-gradient(90deg, var(--accent-teal), color-mix(in srgb, var(--accent-teal) 30%, transparent));
  transform: scaleX(0);
  transform-origin: left;
  opacity: 0;
  transition:
    transform var(--transition-fast),
    opacity var(--transition-fast);
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

.nav-links a.router-link-active::after,
.nav-links a:hover::after,
.nav-links a:focus-visible::after {
  transform: scaleX(1);
  opacity: 1;
}

.nav-links a:hover,
.nav-links a:focus-visible {
  transform: translateY(-1px);
}

.actions {
  grid-area: actions;
  justify-content: flex-end;
  justify-self: end;
  min-width: 0;
}

.navbar-search {
  min-width: min(18rem, 34vw);
  max-width: 23rem;
  border-color: color-mix(in srgb, var(--glass-border) 92%, transparent);
  background: color-mix(in srgb, var(--glass-bg) 88%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 10%, transparent),
    0 0.75rem 1.5rem color-mix(in srgb, var(--bg-primary) 16%, transparent);
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

.navbar-search:focus-within {
  box-shadow: var(--shadow-glow-teal);
}

.menu-shell {
  position: relative;
}

.profile-chip {
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--glass-border) 96%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 88%, transparent);
  padding: 0.35rem 0.55rem 0.35rem 0.35rem;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 12%, transparent),
    0 1rem 2rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
  transition:
    color var(--transition-fast),
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.profile-chip:hover,
.profile-chip:focus-visible,
.profile-chip[aria-expanded='true'] {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--glass-border));
  background: color-mix(in srgb, var(--glass-bg) 96%, transparent);
  box-shadow:
    var(--shadow-md),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 16%, transparent);
}

.profile-chip:active {
  transform: translateY(0) scale(0.97);
}

.profile-chip__avatar-shell {
  position: relative;
  display: inline-grid;
  border-radius: var(--radius-full);
}

.profile-chip__avatar-shell::after {
  content: '';
  position: absolute;
  inset: -0.15rem;
  border-radius: inherit;
  background: radial-gradient(circle at top, color-mix(in srgb, var(--accent-teal) 34%, transparent), transparent 70%);
  z-index: -1;
}

.profile-chip__copy {
  min-width: 0;
  display: grid;
  gap: 0.1rem;
  text-align: left;
}

.profile-chip__copy strong,
.profile-chip__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-chip__copy strong {
  color: var(--text-primary);
  font-size: 0.95rem;
}

.profile-chip__copy small {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.profile-chip__chevron {
  display: inline-flex;
  color: var(--text-secondary);
  transition: transform var(--transition-fast), color var(--transition-fast);
}

.profile-chip[aria-expanded='true'] .profile-chip__chevron {
  color: var(--accent-teal);
  transform: rotate(180deg);
}

.profile-chip__chevron :deep(.atlas-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + var(--space-3));
  right: 0;
  min-width: 17.5rem;
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  overflow: hidden;
  z-index: var(--z-dropdown);
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--glass-border) 100%, transparent);
}

.menu-dropdown::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 20%, transparent), transparent 48%),
    linear-gradient(135deg, color-mix(in srgb, var(--text-primary) 10%, transparent), transparent 42%);
  pointer-events: none;
}

.menu-dropdown > * {
  position: relative;
  z-index: 1;
}

.menu-dropdown:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 3px;
}

.menu-dropdown__profile {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  align-items: center;
}

.menu-dropdown__copy {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.menu-dropdown__eyebrow,
.menu-dropdown__copy p,
.menu-dropdown__copy strong {
  margin: 0;
}

.menu-dropdown__eyebrow {
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.menu-dropdown__copy strong {
  color: var(--text-primary);
  font-size: var(--font-size-body);
}

.menu-dropdown__copy p:last-child {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.menu-dropdown__divider {
  height: 1px;
  background: color-mix(in srgb, var(--glass-border) 100%, transparent);
}

.menu-dropdown__actions {
  display: grid;
  gap: var(--space-1);
}

.menu-dropdown a,
.menu-dropdown button {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 0.85rem 0.95rem;
  border: 0;
  border-radius: var(--radius-xl);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    color var(--transition-fast);
}

.menu-dropdown a:hover,
.menu-dropdown a:focus-visible,
.menu-dropdown button:hover,
.menu-dropdown button:focus-visible {
  background: color-mix(in srgb, var(--accent-teal-light) 72%, transparent);
  box-shadow: 0 1rem 2rem color-mix(in srgb, var(--accent-teal) 16%, transparent);
  transform: translateY(-1px);
  outline: none;
}

.menu-dropdown a:active,
.menu-dropdown button:active {
  transform: translateY(0) scale(0.97);
}

.guest-actions {
  flex-wrap: nowrap;
}

.ghost-link,
.accent-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  padding: 0.72rem 1rem;
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    color var(--transition-fast);
}

.ghost-link {
  border: 1px solid transparent;
}

.ghost-link:hover,
.ghost-link:focus-visible {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--glass-bg) 84%, transparent);
  border-color: color-mix(in srgb, var(--glass-border) 100%, transparent);
}

.ghost-link:active {
  transform: translateY(0) scale(0.97);
}

.accent-link {
  background: var(--accent-teal);
  color: var(--bg-primary);
  box-shadow: var(--shadow-glow-teal);
}

.accent-link:hover,
.accent-link:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow: 0 0 2rem color-mix(in srgb, var(--accent-teal) 34%, transparent);
  outline: none;
  transform: translateY(-1px);
}

.accent-link:active {
  transform: translateY(0) scale(0.97);
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-0.35rem);
}

@media (prefers-reduced-motion: reduce) {
  .navbar,
  .navbar::after,
  .navbar__inner,
  .nav-links a,
  .profile-chip,
  .menu-dropdown a,
  .menu-dropdown button,
  .ghost-link,
  .accent-link,
  .dropdown-fade-enter-active,
  .dropdown-fade-leave-active {
    transition-duration: 1ms;
  }

  .nav-links a:hover,
  .nav-links a:focus-visible,
  .profile-chip:hover,
  .profile-chip:focus-visible,
  .profile-chip[aria-expanded='true'],
  .profile-chip:active,
  .menu-dropdown a:hover,
  .menu-dropdown a:focus-visible,
  .menu-dropdown a:active,
  .menu-dropdown button:hover,
  .menu-dropdown button:focus-visible,
  .menu-dropdown button:active,
  .ghost-link:hover,
  .ghost-link:focus-visible,
  .ghost-link:active,
  .accent-link:hover,
  .accent-link:focus-visible,
  .accent-link:active,
  .navbar--scrolled .navbar__inner {
    transform: none;
  }

  .dropdown-fade-enter-from,
  .dropdown-fade-leave-to,
  .profile-chip[aria-expanded='true'] .profile-chip__chevron {
    transform: none;
  }
}

@media (max-width: 1260px) {
  .navbar__inner {
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
    max-width: none;
  }
}

@media (max-width: 760px) {
  .navbar {
    padding-top: 0.7rem;
  }

  .navbar__inner {
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

  .profile-chip__copy small {
    display: none;
  }
}
</style>
