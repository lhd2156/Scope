<template>
  <footer class="app-footer" aria-labelledby="app-footer-title">
    <div class="app-footer__inner">
      <div class="app-footer__brand">
        <p id="app-footer-title" class="app-footer__logo">Scope</p>
        <p class="app-footer__copy">
          Real places, real photos, and smarter planning for everyday adventures.
        </p>
      </div>

      <nav class="app-footer__nav" aria-label="Footer navigation">
        <section v-for="group in footerGroups" :key="group.title" class="app-footer__group">
          <h2>{{ group.title }}</h2>
          <ul>
            <li v-for="link in group.links" :key="link.label">
              <RouterLink v-if="link.to" :to="link.to">{{ link.label }}</RouterLink>
              <a v-else :href="link.href">{{ link.label }}</a>
            </li>
          </ul>
        </section>
      </nav>

      <div class="app-footer__bottom">
        <p>© {{ currentYear }} Scope. All rights reserved.</p>
        <div class="app-footer__locale" aria-label="Region">
          <ScopeIcon name="map" label="" />
          <span>United States</span>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import ScopeIcon from '@/components/common/ScopeIcon.vue';

interface FooterLink {
  label: string;
  to?: RouteLocationRaw;
  href?: string;
}

interface FooterGroup {
  title: string;
  links: FooterLink[];
}

const currentYear = new Date().getFullYear();

const footerGroups: FooterGroup[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Live Map', to: { name: 'map' } },
      { label: 'Discover Spots', to: { name: 'explore' } },
      { label: 'Trip Planner', to: { name: 'trip-planner' } },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Create Account', to: { name: 'register' } },
      { label: 'Sign In', to: { name: 'login' } },
      { label: 'Friends', to: { name: 'friends' } },
      { label: 'Settings', to: { name: 'settings' } },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Scope', to: { name: 'about' } },
      { label: 'Help', to: { name: 'help' } },
      { label: 'Accessibility', to: { name: 'accessibility' } },
      { label: 'Contact', href: 'mailto:support@scope.travel' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: { name: 'privacy' } },
      { label: 'Terms of Service', to: { name: 'terms' } },
      { label: 'Cookie Choices', to: { name: 'cookies' } },
      { label: 'Security', to: { name: 'security' } },
    ],
  },
];
</script>

<style scoped>
.app-footer {
  flex-shrink: 0;
  padding:
    clamp(var(--space-8), 5vw, var(--space-12))
    calc(var(--shell-side-padding) + var(--safe-area-right))
    calc(var(--space-8) + var(--safe-area-bottom))
    calc(var(--shell-side-padding) + var(--safe-area-left));
  border-top: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
  background: var(--bg-primary);
}

.app-footer__inner {
  width: min(100%, var(--page-max-width));
  margin: 0 auto;
  display: grid;
  gap: clamp(var(--space-8), 4vw, var(--space-12));
}

.app-footer__brand {
  display: grid;
  gap: var(--space-3);
  max-width: 32rem;
}

.app-footer__logo,
.app-footer__copy,
.app-footer__group h2,
.app-footer__group ul,
.app-footer__bottom p {
  margin: 0;
}

.app-footer__logo {
  font-size: var(--font-size-h2);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0;
}

.app-footer__copy {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.app-footer__nav {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(var(--space-6), 4vw, var(--space-12));
}

.app-footer__group {
  display: grid;
  align-content: start;
  gap: var(--space-4);
}

.app-footer__group h2 {
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
}

.app-footer__group ul {
  display: grid;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}

.app-footer__group a {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  min-height: 2rem;
  align-items: center;
  padding: 0.25rem 0.5rem;
  margin-left: -0.5rem;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.app-footer__group a:hover,
.app-footer__group a:focus-visible {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  outline: none;
}

.app-footer__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-6);
  border-top: 1px solid color-mix(in srgb, var(--glass-border) 68%, transparent);
  color: var(--text-muted);
  font-size: var(--font-size-caption);
}

.app-footer__locale {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-secondary);
}

.app-footer__locale :deep(.scope-icon) {
  width: 0.9rem;
  height: 0.9rem;
}

@media (max-width: 900px) {
  .app-footer__nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .app-footer__nav {
    grid-template-columns: minmax(0, 1fr);
  }

  .app-footer__bottom {
    align-items: flex-start;
    flex-direction: column-reverse;
  }
}
</style>
