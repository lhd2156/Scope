<template>
  <header
    class="guest-navbar"
    :class="{ 'guest-navbar--scrolled': isScrolled, 'guest-navbar--mobile-open': isMobileMenuOpen }"
  >
    <div class="guest-navbar__inner">
      <div class="guest-navbar__leading">
        <RouterLink to="/" class="guest-navbar__brand" @click="closeMobileMenu()">
          <span class="guest-navbar__brand-mark" aria-hidden="true">
            <ScopeIcon name="logo" />
          </span>
          <span class="guest-navbar__brand-text">Scope</span>
        </RouterLink>

        <nav class="guest-navbar__links" aria-label="Primary">
          <RouterLink to="/" exact-active-class="is-active">Home</RouterLink>
          <RouterLink to="/explore" active-class="is-active">Explore</RouterLink>
          <RouterLink to="/map" active-class="is-active">Map</RouterLink>
        </nav>
      </div>

      <div class="guest-navbar__actions">
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
          <ScopeIcon
            :name="isMobileMenuOpen ? 'close' : 'menu'"
            :label="isMobileMenuOpen ? 'Close navigation drawer' : 'Open navigation drawer'"
          />
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
        class="guest-navbar__mobile-drawer"
        role="dialog"
        :aria-labelledby="mobileMenuTitleId"
        aria-modal="true"
        tabindex="-1"
      >
        <div class="guest-navbar__mobile-header">
          <div class="guest-navbar__mobile-heading">
            <p class="guest-navbar__mobile-eyebrow">Discover Scope</p>
            <h2 :id="mobileMenuTitleId">Plan your next adventure</h2>
          </div>

          <button
            type="button"
            class="guest-navbar__mobile-close"
            aria-label="Close navigation drawer"
            @click="closeMobileMenu()"
          >
            <ScopeIcon name="close" label="Close navigation drawer" />
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
              <ScopeIcon :name="link.icon" />
            </span>
            <span class="guest-navbar__mobile-link-copy">
              <strong>{{ link.label }}</strong>
              <small>{{ link.description }}</small>
            </span>
            <ScopeIcon class="guest-navbar__mobile-link-chevron" name="arrow-right" />
          </RouterLink>
        </nav>

        <div class="guest-navbar__mobile-footer">
          <RouterLink class="guest-navbar__mobile-secondary" to="/login" @click="closeMobileMenu()">
            Log in
          </RouterLink>
          <RouterLink class="guest-navbar__mobile-primary" to="/register" @click="closeMobileMenu()">
            Create account
          </RouterLink>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import ScopeIcon from '@/components/common/ScopeIcon.vue';

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
    description: 'Curated highlights and featured journeys.',
  },
  {
    label: 'Explore',
    to: '/explore',
    icon: 'explore',
    description: 'Standout spots across the Scope community.',
  },
  {
    label: 'Map',
    to: '/map',
    icon: 'map',
    description: 'Open the live travel map workspace.',
  },
]);

function updateScrollState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  isScrolled.value = window.scrollY > 16;
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
  position: fixed;
  inset: 0 0 auto;
  z-index: var(--z-navbar);
  padding-top: var(--safe-area-top);
  background: color-mix(in srgb, var(--bg-primary) 72%, transparent);
  backdrop-filter: blur(18px) saturate(1.2);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
  border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.guest-navbar--scrolled {
  background: color-mix(in srgb, var(--bg-primary) 92%, transparent);
  border-bottom-color: color-mix(in srgb, var(--border) 88%, transparent);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--border) 40%, transparent);
}

.guest-navbar__inner {
  /*
   * Public routes share the same centered rail as their page content so
   * the nav, map, home, and explore surfaces line up on wide screens.
   */
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-5);
  width: 100%;
  max-width: var(--shell-max-width-with-safe-area);
  min-height: 4.5rem;
  margin: 0 auto;
  padding-block: 0.5rem;
  padding-inline:
    calc(var(--shell-side-padding) + var(--safe-area-left))
    calc(var(--shell-side-padding) + var(--safe-area-right));
}

.guest-navbar__leading,
.guest-navbar__actions,
.guest-navbar__auth-actions {
  align-self: center;
}

.guest-navbar__leading {
  display: inline-flex;
  align-items: center;
  gap: var(--space-5);
  min-width: 0;
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
  gap: 0.6rem;
  color: var(--text-primary);
  font-weight: 700;
  letter-spacing: -0.015em;
  font-size: 1.05rem;
}

.guest-navbar__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.625rem;
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 14%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent-teal) 82%, var(--bg-secondary)),
    color-mix(in srgb, var(--accent-teal-hover, var(--accent-teal)) 74%, var(--bg-secondary))
  );
  color: var(--text-inverse);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 18%, transparent);
}

.guest-navbar__brand-mark :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.guest-navbar__links {
  display: flex;
  justify-content: flex-start;
  gap: 0.15rem;
}

.guest-navbar__links a {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 2.25rem;
  padding: 0 0.85rem;
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 0.9rem;
  letter-spacing: 0.005em;
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.guest-navbar__links a:hover,
.guest-navbar__links a:focus-visible {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-primary) 6%, transparent);
  outline: none;
}

.guest-navbar__links a.is-active {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal) 14%, transparent);
}

.guest-navbar__brand:hover,
.guest-navbar__brand:focus-visible {
  outline: none;
  color: var(--text-primary);
}

.guest-navbar__actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  justify-self: end;
}

.guest-navbar__auth-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.guest-navbar__ghost-link,
.guest-navbar__accent-link,
.guest-navbar__mobile-secondary,
.guest-navbar__mobile-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  height: 2.375rem;
  padding: 0 1rem;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 0.88rem;
  letter-spacing: 0.005em;
  white-space: nowrap;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.guest-navbar__ghost-link,
.guest-navbar__mobile-secondary {
  border: 1px solid transparent;
  color: var(--text-secondary);
  background: transparent;
}

.guest-navbar__ghost-link:hover,
.guest-navbar__ghost-link:focus-visible,
.guest-navbar__mobile-secondary:hover,
.guest-navbar__mobile-secondary:focus-visible {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-primary) 7%, transparent);
  outline: none;
}

.guest-navbar__accent-link,
.guest-navbar__mobile-primary {
  color: var(--text-inverse);
  background: linear-gradient(
    135deg,
    var(--accent-teal),
    var(--accent-teal-hover, var(--accent-teal))
  );
  border: 1px solid transparent;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 24%, transparent),
    var(--shadow-sm);
}

.guest-navbar__accent-link:hover,
.guest-navbar__accent-link:focus-visible,
.guest-navbar__mobile-primary:hover,
.guest-navbar__mobile-primary:focus-visible {
  outline: none;
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 28%, transparent),
    var(--shadow-sm);
}

.guest-navbar__mobile-toggle,
.guest-navbar__mobile-close {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.375rem;
  height: 2.375rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.guest-navbar__mobile-toggle :deep(svg),
.guest-navbar__mobile-close :deep(svg) {
  width: 1.15rem;
  height: 1.15rem;
}

.guest-navbar__mobile-toggle:hover,
.guest-navbar__mobile-toggle:focus-visible,
.guest-navbar__mobile-close:hover,
.guest-navbar__mobile-close:focus-visible {
  background: color-mix(in srgb, var(--text-primary) 7%, transparent);
  border-color: var(--border);
  outline: none;
}

.guest-navbar__mobile-overlay {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal) - 2);
  display: grid;
  align-items: start;
  justify-items: stretch;
  padding: calc(var(--safe-area-top) + var(--space-4)) var(--space-4) var(--space-4);
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.guest-navbar__mobile-drawer {
  width: 100%;
  max-width: 28rem;
  margin: 0 auto;
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5);
  border-radius: var(--radius-xl, 1.25rem);
  background: color-mix(in srgb, var(--bg-elevated, var(--bg-secondary)) 96%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  box-shadow: var(--shadow-lg, 0 20px 60px rgba(0, 0, 0, 0.35));
}

.guest-navbar__mobile-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-4);
  align-items: start;
}

.guest-navbar__mobile-heading {
  display: grid;
  gap: 0.35rem;
}

.guest-navbar__mobile-eyebrow {
  margin: 0;
  color: var(--accent-teal);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.guest-navbar__mobile-header h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.guest-navbar__mobile-nav {
  display: grid;
  gap: var(--space-2);
}

.guest-navbar__mobile-link {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: center;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-lg, 0.85rem);
  border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 30%, transparent);
  color: var(--text-primary);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
}

.guest-navbar__mobile-link:hover,
.guest-navbar__mobile-link:focus-visible {
  outline: none;
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 45%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 8%, transparent);
}

.guest-navbar__mobile-link-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.6rem;
  background: color-mix(in srgb, var(--accent-teal) 14%, transparent);
  color: var(--accent-teal);
}

.guest-navbar__mobile-link-icon :deep(svg) {
  width: 1.05rem;
  height: 1.05rem;
}

.guest-navbar__mobile-link-copy {
  display: grid;
  gap: 0.15rem;
}

.guest-navbar__mobile-link-copy strong {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.guest-navbar__mobile-link-copy small {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.45;
}

.guest-navbar__mobile-link-chevron {
  width: 1rem;
  height: 1rem;
  color: var(--text-tertiary, var(--text-secondary));
  transition: transform var(--transition-fast);
}

.guest-navbar__mobile-link:hover .guest-navbar__mobile-link-chevron,
.guest-navbar__mobile-link:focus-visible .guest-navbar__mobile-link-chevron {
  transform: translateX(2px);
  color: var(--accent-teal);
}

.guest-navbar__mobile-footer {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: var(--space-2);
}

.guest-navbar__mobile-secondary {
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
}

.guest-navbar-backdrop-enter-active,
.guest-navbar-backdrop-leave-active {
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.guest-navbar-backdrop-enter-from,
.guest-navbar-backdrop-leave-to {
  opacity: 0;
}

.guest-navbar-backdrop-enter-from .guest-navbar__mobile-drawer,
.guest-navbar-backdrop-leave-to .guest-navbar__mobile-drawer {
  transform: translateY(-0.75rem);
}

/* Hide text on "Create account" for tighter tablet fit */
@media (max-width: 960px) {
  .guest-navbar__links {
    gap: 0.15rem;
  }

  .guest-navbar__links a {
    padding: 0 0.7rem;
    font-size: 0.875rem;
  }
}

/* Below 640px: collapse to hamburger */
@media (max-width: 640px) {
  .guest-navbar__links,
  .guest-navbar__auth-actions {
    display: none;
  }

  .guest-navbar__leading {
    gap: 0;
  }

  .guest-navbar__inner {
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 3.75rem;
  }

  .guest-navbar__mobile-toggle,
  .guest-navbar__mobile-close {
    display: inline-flex;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guest-navbar,
  .guest-navbar__links a,
  .guest-navbar__ghost-link,
  .guest-navbar__accent-link,
  .guest-navbar__mobile-secondary,
  .guest-navbar__mobile-primary,
  .guest-navbar__mobile-link,
  .guest-navbar-backdrop-enter-active,
  .guest-navbar-backdrop-leave-active {
    transition-duration: 1ms;
  }

  .guest-navbar__accent-link:hover,
  .guest-navbar__accent-link:focus-visible,
  .guest-navbar__mobile-primary:hover,
  .guest-navbar__mobile-primary:focus-visible,
  .guest-navbar__mobile-link:hover,
  .guest-navbar__mobile-link:focus-visible {
    transform: none;
  }

  .guest-navbar-backdrop-enter-from .guest-navbar__mobile-drawer,
  .guest-navbar-backdrop-leave-to .guest-navbar__mobile-drawer {
    transform: none;
  }
}
</style>
