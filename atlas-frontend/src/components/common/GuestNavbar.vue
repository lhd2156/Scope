<template>
  <header class="guest-navbar" :class="{ 'guest-navbar--scrolled': isScrolled, 'guest-navbar--mobile-open': isMobileMenuOpen }">
    <div class="guest-navbar__inner">
      <RouterLink to="/" class="guest-navbar__brand" @click="closeMobileMenu()">
        <AtlasIcon name="logo" />
        <span>Atlas</span>
      </RouterLink>

      <nav class="guest-navbar__links" aria-label="Primary">
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/explore">Explore</RouterLink>
        <RouterLink to="/map">Map</RouterLink>
      </nav>

      <div class="guest-navbar__actions">
        <ThemeToggle />

        <div class="guest-navbar__auth-actions">
          <RouterLink class="guest-navbar__ghost-link" to="/login">Log in</RouterLink>
          <RouterLink class="guest-navbar__accent-link" to="/register">Create account</RouterLink>
        </div>

        <button
          type="button"
          class="guest-navbar__mobile-toggle"
          :aria-expanded="String(isMobileMenuOpen)"
          :aria-controls="isMobileMenuOpen ? mobileMenuId : undefined"
          :aria-label="isMobileMenuOpen ? 'Close navigation drawer' : 'Open navigation drawer'"
          @click="toggleMobileMenu"
        >
          <AtlasIcon :name="isMobileMenuOpen ? 'close' : 'menu'" :label="isMobileMenuOpen ? 'Close navigation drawer' : 'Open navigation drawer'" />
        </button>
      </div>
    </div>
  </header>

  <Transition name="guest-navbar-backdrop">
    <div
      v-if="isMobileMenuOpen"
      class="guest-navbar__mobile-overlay"
      @click.self="closeMobileMenu()"
    >
      <aside
        :id="mobileMenuId"
        ref="mobileDrawerRef"
        class="guest-navbar__mobile-drawer glass-panel"
        role="dialog"
        :aria-labelledby="mobileMenuTitleId"
        aria-modal="true"
        tabindex="-1"
      >
        <div class="guest-navbar__mobile-header">
          <div>
            <p class="guest-navbar__mobile-eyebrow">Discover Atlas</p>
            <h2 :id="mobileMenuTitleId">Plan your next adventure</h2>
            <p>Explore premium routes, map-worthy stops, and community favorites before you create an account.</p>
          </div>

          <button
            type="button"
            class="guest-navbar__mobile-close"
            aria-label="Close navigation drawer"
            @click="closeMobileMenu()"
          >
            <AtlasIcon name="close" label="Close navigation drawer" />
          </button>
        </div>

        <nav class="guest-navbar__mobile-nav" aria-label="Mobile primary">
          <RouterLink
            v-for="link in mobileLinks"
            :key="link.to"
            :to="link.to"
            class="guest-navbar__mobile-link"
            @click="closeMobileMenu()"
          >
            <span class="guest-navbar__mobile-link-icon" aria-hidden="true">
              <AtlasIcon :name="link.icon" :label="link.label" />
            </span>
            <span class="guest-navbar__mobile-link-copy">
              <strong>{{ link.label }}</strong>
              <small>{{ link.description }}</small>
            </span>
          </RouterLink>
        </nav>

        <div class="guest-navbar__mobile-footer">
          <RouterLink class="guest-navbar__mobile-secondary" to="/login" @click="closeMobileMenu()">Log in</RouterLink>
          <RouterLink class="guest-navbar__mobile-primary" to="/register" @click="closeMobileMenu()">Create account</RouterLink>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';

const route = useRoute();
const isScrolled = ref(false);
const isMobileMenuOpen = ref(false);
const mobileDrawerRef = ref<HTMLElement | null>(null);
const mobileMenuId = `guest-navbar-mobile-menu-${useId()}`;
const mobileMenuTitleId = `guest-navbar-mobile-menu-title-${useId()}`;
const mobileLinks = computed(() => [
  {
    label: 'Home',
    to: '/',
    icon: 'home',
    description: 'See the latest curated highlights and featured journeys.',
  },
  {
    label: 'Explore',
    to: '/explore',
    icon: 'explore',
    description: 'Browse cities, vibes, and standout spots from the Atlas community.',
  },
  {
    label: 'Map',
    to: '/map',
    icon: 'map',
    description: 'Open the live travel map and preview where your next trip could start.',
  },
]);

function updateScrollState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  isScrolled.value = window.scrollY > 24;
}

function closeMobileMenu(): void {
  isMobileMenuOpen.value = false;
}

function toggleMobileMenu(): void {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
}

watch(
  () => route.fullPath,
  () => {
    closeMobileMenu();
    updateScrollState();
  },
  { immediate: true },
);

watch(
  () => isMobileMenuOpen.value,
  async (isOpen) => {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.style.overflow = isOpen ? 'hidden' : '';

    if (isOpen) {
      await nextTick();
      mobileDrawerRef.value?.focus();
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (typeof window === 'undefined') {
    return;
  }

  updateScrollState();
  window.addEventListener('scroll', updateScrollState, { passive: true });
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', updateScrollState);
  }

  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
});
</script>

<style scoped>
.guest-navbar {
  position: sticky;
  top: 0;
  z-index: var(--z-fixed);
  width: min(100%, var(--layout-max-width));
  margin: 0 auto;
  padding: calc(var(--safe-area-inset-top) + var(--space-4)) var(--space-4) 0;
  transition: transform var(--transition-fast), padding var(--transition-fast);
}

.guest-navbar__inner,
.guest-navbar__links,
.guest-navbar__actions,
.guest-navbar__auth-actions,
.guest-navbar__mobile-header,
.guest-navbar__mobile-nav,
.guest-navbar__mobile-link,
.guest-navbar__mobile-link-copy,
.guest-navbar__mobile-footer {
  display: grid;
}

.guest-navbar__inner {
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-5);
  padding: 0.9rem 1.25rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, transparent);
  border-radius: calc(var(--radius-xl) + var(--space-1));
  background: color-mix(in srgb, var(--glass-bg) 94%, var(--bg-primary) 6%);
  box-shadow: var(--shadow-md);
}

.guest-navbar--scrolled .guest-navbar__inner,
.guest-navbar--mobile-open .guest-navbar__inner {
  background: color-mix(in srgb, var(--glass-bg) 94%, var(--bg-primary) 6%);
  border-color: color-mix(in srgb, var(--glass-border) 84%, var(--accent-teal) 16%);
}

.guest-navbar__brand,
.guest-navbar__links a,
.guest-navbar__ghost-link,
.guest-navbar__accent-link,
.guest-navbar__mobile-link,
.guest-navbar__mobile-secondary,
.guest-navbar__mobile-primary {
  text-decoration: none;
}

.guest-navbar__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-primary);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.guest-navbar__links {
  grid-auto-flow: column;
  justify-content: center;
  gap: var(--space-4);
}

.guest-navbar__links a {
  color: var(--text-secondary);
  font-weight: 600;
  transition: color var(--transition-fast), transform var(--transition-fast);
}

.guest-navbar__links a:hover,
.guest-navbar__links a:focus-visible,
.guest-navbar__brand:hover,
.guest-navbar__brand:focus-visible {
  color: var(--text-primary);
  transform: translateY(-1px);
  outline: none;
}

.guest-navbar__actions {
  grid-auto-flow: column;
  align-items: center;
  gap: var(--space-3);
}

.guest-navbar__auth-actions {
  grid-auto-flow: column;
  align-items: center;
  gap: var(--space-2);
}

.guest-navbar__ghost-link,
.guest-navbar__accent-link,
.guest-navbar__mobile-secondary,
.guest-navbar__mobile-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.75rem 1.15rem;
  border-radius: var(--radius-full);
  font-weight: 600;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.guest-navbar__ghost-link,
.guest-navbar__mobile-secondary {
  border: 1px solid var(--border);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--glass-bg) 70%, transparent);
}

.guest-navbar__accent-link,
.guest-navbar__mobile-primary {
  color: var(--text-inverse);
  background: linear-gradient(135deg, var(--accent-teal), color-mix(in srgb, var(--accent-teal-strong) 76%, var(--accent-teal) 24%));
  box-shadow: var(--shadow-glow-teal);
}

.guest-navbar__ghost-link:hover,
.guest-navbar__ghost-link:focus-visible,
.guest-navbar__accent-link:hover,
.guest-navbar__accent-link:focus-visible,
.guest-navbar__mobile-secondary:hover,
.guest-navbar__mobile-secondary:focus-visible,
.guest-navbar__mobile-primary:hover,
.guest-navbar__mobile-primary:focus-visible {
  transform: translateY(-1px);
  outline: none;
}

.guest-navbar__mobile-toggle,
.guest-navbar__mobile-close {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.85rem;
  height: 2.85rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--glass-bg) 74%, transparent);
  color: var(--text-primary);
  cursor: pointer;
}

.guest-navbar__mobile-overlay {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal) - 2);
  display: grid;
  align-items: start;
  justify-items: end;
  padding: calc(var(--safe-area-inset-top) + 5.5rem) var(--space-4) var(--space-4);
  background: color-mix(in srgb, var(--bg-primary) 70%, transparent);
  backdrop-filter: blur(16px);
}

.guest-navbar__mobile-drawer {
  width: min(100%, 25rem);
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5);
}

.guest-navbar__mobile-header {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-4);
  align-items: start;
}

.guest-navbar__mobile-eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.guest-navbar__mobile-header h2,
.guest-navbar__mobile-header p,
.guest-navbar__mobile-link-copy strong,
.guest-navbar__mobile-link-copy small {
  margin: 0;
}

.guest-navbar__mobile-header h2 {
  font-size: 1.25rem;
  color: var(--text-primary);
}

.guest-navbar__mobile-header p,
.guest-navbar__mobile-link-copy small {
  color: var(--text-secondary);
  line-height: 1.6;
}

.guest-navbar__mobile-nav {
  gap: var(--space-3);
}

.guest-navbar__mobile-link {
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  align-items: center;
  padding: 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--glass-border) 88%, transparent);
  background: color-mix(in srgb, var(--surface-elevated) 72%, transparent);
}

.guest-navbar__mobile-link-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 16%, transparent);
  color: var(--accent-teal);
}

.guest-navbar__mobile-link-copy {
  gap: var(--space-1);
}

.guest-navbar__mobile-link-copy strong {
  color: var(--text-primary);
}

.guest-navbar__mobile-footer {
  gap: var(--space-3);
}

.guest-navbar-backdrop-enter-active,
.guest-navbar-backdrop-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.guest-navbar-backdrop-enter-from,
.guest-navbar-backdrop-leave-to {
  opacity: 0;
}

.guest-navbar-backdrop-enter-from .guest-navbar__mobile-drawer,
.guest-navbar-backdrop-leave-to .guest-navbar__mobile-drawer {
  transform: translateY(-8px);
}

@media (max-width: 1024px) {
  .guest-navbar__inner {
    grid-template-columns: auto 1fr auto;
  }

  .guest-navbar__links,
  .guest-navbar__auth-actions {
    display: none;
  }

  .guest-navbar__actions {
    justify-content: end;
  }

  .guest-navbar__mobile-toggle,
  .guest-navbar__mobile-close {
    display: inline-flex;
  }
}

@media (max-width: 640px) {
  .guest-navbar {
    padding-inline: var(--space-3);
  }

  .guest-navbar__inner {
    gap: var(--space-3);
    padding-inline: 1rem;
  }

  .guest-navbar__mobile-overlay {
    padding-inline: var(--space-3);
  }

  .guest-navbar__mobile-drawer {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guest-navbar,
  .guest-navbar__links a,
  .guest-navbar__ghost-link,
  .guest-navbar__accent-link,
  .guest-navbar__mobile-secondary,
  .guest-navbar__mobile-primary,
  .guest-navbar-backdrop-enter-active,
  .guest-navbar-backdrop-leave-active {
    transition-duration: 1ms;
  }

  .guest-navbar__links a:hover,
  .guest-navbar__links a:focus-visible,
  .guest-navbar__brand:hover,
  .guest-navbar__brand:focus-visible,
  .guest-navbar__ghost-link:hover,
  .guest-navbar__ghost-link:focus-visible,
  .guest-navbar__accent-link:hover,
  .guest-navbar__accent-link:focus-visible,
  .guest-navbar__mobile-secondary:hover,
  .guest-navbar__mobile-secondary:focus-visible,
  .guest-navbar__mobile-primary:hover,
  .guest-navbar__mobile-primary:focus-visible {
    transform: none;
  }

  .guest-navbar-backdrop-enter-from .guest-navbar__mobile-drawer,
  .guest-navbar-backdrop-leave-to .guest-navbar__mobile-drawer {
    transform: none;
  }
}
</style>
