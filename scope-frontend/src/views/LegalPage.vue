<template>
  <AppShell>
    <main class="page-container legal-page" aria-labelledby="legal-page-title">
      <header class="legal-header" data-test="legal-hero">
        <p class="legal-kicker">{{ page.eyebrow }}</p>
        <h1 id="legal-page-title">{{ page.title }}</h1>
        <div class="legal-meta" aria-label="Page details">
          <span>Effective {{ updatedDate }}</span>
          <span>{{ page.coverage }}</span>
        </div>
        <p class="legal-summary">{{ page.summary }}</p>
      </header>

      <nav class="legal-switcher" aria-label="Related Scope pages" data-test="legal-page-switcher">
        <span class="legal-switcher__label">Related pages</span>
        <RouterLink
          v-for="link in legalNav"
          :key="link.name"
          :to="link.to"
          class="legal-switcher__link"
          :class="{ 'is-active': link.name === pageKey }"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <article class="legal-document" aria-label="Document sections" data-test="legal-document">
        <section v-for="section in sectionsWithIds" :id="section.id" :key="section.id" class="legal-section">
          <h2>{{ section.title }}</h2>
          <p>{{ section.body }}</p>
          <ul v-if="section.items?.length">
            <li v-for="item in section.items" :key="item">{{ item }}</li>
          </ul>
        </section>
      </article>
    </main>
  </AppShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';

interface LegalSection {
  title: string;
  body: string;
  items?: string[];
}

interface LegalPageContent {
  eyebrow: string;
  title: string;
  updated: string;
  coverage: string;
  summary: string;
  sections: LegalSection[];
}

interface LegalSectionWithId extends LegalSection {
  id: string;
}

const legalNav = [
  { name: 'privacy', label: 'Privacy', to: '/privacy' },
  { name: 'terms', label: 'Terms', to: '/terms' },
  { name: 'cookies', label: 'Cookies', to: '/cookies' },
  { name: 'security', label: 'Security', to: '/security' },
  { name: 'accessibility', label: 'Accessibility', to: '/accessibility' },
  { name: 'about', label: 'About', to: '/about' },
  { name: 'help', label: 'Help', to: '/help' },
] as const;

const legalPages: Record<string, LegalPageContent> = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    updated: 'Last updated April 28, 2026',
    coverage: 'Scope web, map, feed, and trip planning services',
    summary: 'This policy explains the information Scope collects, how it is used, and the choices available to you.',
    sections: [
      {
        title: 'Scope',
        body: 'This policy applies when you use Scope websites, maps, social feed features, trip planning tools, account settings, and related support channels.',
      },
      {
        title: 'Information we collect',
        body: 'Scope collects information you provide directly, information created through your use of the service, and limited technical information needed to operate the product.',
        items: [
          'Account details such as name, username, email address, birthday, password credentials handled by the authentication service, profile settings, and support messages.',
          'Content you choose to create, including pins, photos, captions, reviews, comments, likes, routes, trip plans, and friend activity.',
          'Map and location inputs such as searched places, selected map areas, route points, and live trip-location updates when you use those features.',
        ],
      },
      {
        title: 'How we use information',
        body: 'We use information to provide and secure Scope, personalize the experience, operate recommendations, maintain account state, prevent abuse, troubleshoot reliability, and improve product quality.',
      },
      {
        title: 'AI and recommendations',
        body: 'Scope may use spot, review, preference, and trip-planning context to generate recommendations or itineraries. Generated output may be incomplete or inaccurate, so you should verify travel details before relying on it.',
      },
      {
        title: 'Cookies and local storage',
        body: 'Essential storage supports sign-in, security, theme, onboarding, and offline reliability. Optional analytics storage is used only when enabled to help us understand usage patterns.',
      },
      {
        title: 'Sharing',
        body: 'Public content may be visible to other Scope users. We also use service providers for hosting, maps, storage, email, analytics, and security. Scope does not sell personal information.',
      },
      {
        title: 'Retention and deletion',
        body: 'We keep account and content data while your account is active or as needed for security, backups, legal obligations, and dispute handling. You can request account or content deletion through support.',
      },
      {
        title: 'Children and contact',
        body: 'Scope is intended for users who are at least 13 years old. Questions about this policy can be sent to privacy@scopetrips.com or support@scopetrips.com.',
      },
    ],
  },
  terms: {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    updated: 'Last updated April 28, 2026',
    coverage: 'Scope accounts, maps, content, AI tools, and trip planning services',
    summary: 'These terms govern access to Scope and describe the rules for accounts, shared content, maps, AI output, and responsible use.',
    sections: [
      {
        title: 'Acceptance',
        body: 'By using Scope, you agree to these terms. If you do not agree, do not use the service.',
      },
      {
        title: 'Eligibility and accounts',
        body: 'You must be at least 13 years old to use Scope. You are responsible for accurate account information, credential security, and activity under your account.',
      },
      {
        title: 'Your content',
        body: 'You keep ownership of photos, reviews, routes, and other content you add. You give Scope permission to host, display, process, resize, recommend, and share that content as needed to operate the service.',
      },
      {
        title: 'Content rules',
        body: 'Do not upload illegal, harmful, deceptive, private, infringing, hateful, explicit, spammy, or unsafe content. Only post places, photos, and stories you have the right to share.',
      },
      {
        title: 'Safety and third-party services',
        body: 'Scope helps people discover places, but conditions can change. You are responsible for checking local rules, weather, accessibility, hours, prices, permits, transportation, and personal safety. Third-party terms may apply to services such as maps, authentication, hosting, analytics, messaging, and storage.',
      },
      {
        title: 'AI and map information',
        body: 'AI routes, recommendations, summaries, rankings, and map data are informational and may contain errors. Scope does not guarantee that generated itineraries are complete, safe, available, or suitable for every traveler.',
      },
      {
        title: 'Prohibited use',
        body: 'Do not attack, scrape, reverse engineer, overload, bypass security, abuse APIs, harvest personal data, impersonate others, or use Scope to coordinate unlawful or harmful activity.',
      },
      {
        title: 'Changes, suspension, and termination',
        body: 'Scope is evolving. Features may change or become unavailable. We may suspend or remove access if an account creates risk, violates these terms, harms other users, or threatens the service.',
      },
      {
        title: 'Disclaimers and contact',
        body: 'Scope is provided as available and without guarantees of uninterrupted service or perfect data. Questions about these terms can be sent to legal@scopetrips.com or support@scopetrips.com.',
      },
    ],
  },
  cookies: {
    eyebrow: 'Privacy',
    title: 'Cookie Choices',
    updated: 'Last updated April 28, 2026',
    coverage: 'Scope browser storage and optional analytics preferences',
    summary: 'Scope uses essential browser storage for core product behavior and asks before optional analytics are enabled.',
    sections: [
      {
        title: 'Essential storage',
        body: 'Essential storage keeps sign-in, security, theme, onboarding, and offline reliability working. These items are required for the service to function.',
      },
      {
        title: 'Optional analytics',
        body: 'Optional analytics help us understand page usage, map interactions, and planning flows so we can improve Scope. They are used only after you allow analytics.',
      },
      {
        title: 'Changing your choice',
        body: 'You can change your choice by using the cookie banner when it appears again or by clearing Scope site data in your browser.',
      },
    ],
  },
  security: {
    eyebrow: 'Security',
    title: 'Security',
    updated: 'Last updated April 28, 2026',
    coverage: 'Scope accounts, APIs, infrastructure, and operational controls',
    summary: 'Scope uses layered controls to protect accounts, APIs, and application infrastructure.',
    sections: [
      {
        title: 'Account protection',
        body: 'Passwords are hashed server-side, sessions use access and refresh tokens, and protected routes require authentication.',
      },
      {
        title: 'Application controls',
        body: 'Scope services validate input, apply rate limits, use security headers, and keep secrets outside source-controlled configuration.',
      },
      {
        title: 'Operational practices',
        body: 'The platform is designed around service boundaries, least necessary access, logging, backups, and security review before deployment.',
      },
      {
        title: 'Reporting',
        body: 'Report security concerns to security@scope.dev. Please include enough detail for us to reproduce and investigate the issue.',
      },
    ],
  },
  accessibility: {
    eyebrow: 'Accessibility',
    title: 'Accessibility',
    updated: 'Last updated April 28, 2026',
    coverage: 'Scope web application and responsive layouts',
    summary: 'Scope aims to provide readable, navigable interfaces across desktop and mobile screens.',
    sections: [
      {
        title: 'Current support',
        body: 'We design controls with semantic labels, visible focus states, keyboard navigation, responsive layouts, and readable contrast.',
      },
      {
        title: 'Known work',
        body: 'Advanced map interactions will continue to receive improved keyboard and screen-reader support as the product matures.',
      },
      {
        title: 'Feedback',
        body: 'Send accessibility issues to support@scopetrips.com so we can prioritize fixes.',
      },
    ],
  },
  about: {
    eyebrow: 'Company',
    title: 'About Scope',
    updated: 'Last updated April 28, 2026',
    coverage: 'Scope product overview',
    summary: 'Scope is a map-first adventure platform for discovering, documenting, and planning real-world experiences.',
    sections: [
      {
        title: 'What Scope does',
        body: 'Travelers drop pins, share photos and stories, discover community-loved places, and build smarter itineraries.',
      },
      {
        title: 'Who Scope serves',
        body: 'Scope is built for people who want trips to feel less generic and more connected to real local signals.',
      },
      {
        title: 'Product direction',
        body: 'Scope is growing toward richer maps, stronger recommendations, and better planning tools for individuals and groups.',
      },
    ],
  },
  help: {
    eyebrow: 'Support',
    title: 'Help',
    updated: 'Last updated April 28, 2026',
    coverage: 'Scope support and common product flows',
    summary: 'Use this page for quick guidance on the main Scope workflows.',
    sections: [
      {
        title: 'Explore places',
        body: 'Use Explore and the live map to browse spots by category, vibe, and location.',
      },
      {
        title: 'Plan trips',
        body: 'Create a trip or use Scope AI to turn saved places into a route.',
      },
      {
        title: 'Contact support',
        body: 'For support, email support@scopetrips.com.',
      },
    ],
  },
};

const route = useRoute();

const pageKey = computed(() => {
  const routeName = typeof route.name === 'string' ? route.name : 'privacy';
  return routeName in legalPages ? routeName : 'privacy';
});

const page = computed(() => legalPages[pageKey.value] ?? legalPages.privacy);

const updatedDate = computed(() => page.value.updated.replace(/^Last updated\s*/i, ''));

const sectionsWithIds = computed<LegalSectionWithId[]>(() => {
  return page.value.sections.map((section) => ({
    ...section,
    id: slugify(section.title),
  }));
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
</script>

<style scoped>
.legal-page {
  display: grid;
  gap: var(--space-8);
  width: min(100%, 66rem);
  margin-inline: auto;
  padding-bottom: var(--space-12);
}

.legal-header {
  display: grid;
  gap: var(--space-4);
  padding-block: clamp(var(--space-6), 5vw, var(--space-10)) var(--space-4);
  border-bottom: 1px solid var(--border);
}

.legal-kicker,
.legal-header h1,
.legal-summary,
.legal-section h2,
.legal-section p,
.legal-section ul {
  margin: 0;
}

.legal-kicker {
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
}

.legal-header h1 {
  color: var(--text-primary);
  font-size: clamp(2.25rem, 6vw, 3.5rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.legal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: 1.4;
}

.legal-meta span + span::before {
  content: '/';
  margin-right: var(--space-4);
  color: color-mix(in srgb, var(--text-secondary) 55%, transparent);
}

.legal-summary {
  max-width: 48rem;
  color: var(--text-secondary);
  font-size: clamp(1rem, 1.3vw, 1.12rem);
  line-height: 1.65;
}

.legal-switcher {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--border);
}

.legal-switcher__label {
  color: var(--text-muted);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.legal-switcher__link {
  display: inline-flex;
  align-items: center;
  min-height: 1.75rem;
  padding-block: 0.15rem;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast),
    background var(--transition-fast);
}

.legal-switcher__link:hover,
.legal-switcher__link:focus-visible,
.legal-switcher__link.is-active {
  color: var(--text-primary);
  outline: none;
}

.legal-switcher__link.is-active {
  border-bottom-color: var(--accent-teal);
}

.legal-document {
  display: grid;
  gap: var(--space-8);
  max-width: 54rem;
}

.legal-section {
  display: grid;
  gap: var(--space-3);
  padding-bottom: var(--space-8);
  border-bottom: 1px solid var(--border);
  scroll-margin-top: calc(var(--shell-content-top) + var(--space-6));
}

.legal-section:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.legal-section h2 {
  color: var(--text-primary);
  font-size: clamp(1.25rem, 2vw, 1.65rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.legal-section p,
.legal-section li {
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.7;
}

.legal-section ul {
  display: grid;
  gap: var(--space-2);
  padding-left: 1.25rem;
}

.legal-section li::marker {
  color: var(--accent-teal);
}

@media (max-width: 640px) {
  .legal-page {
    gap: var(--space-6);
  }

  .legal-meta {
    display: grid;
    gap: var(--space-2);
  }

  .legal-meta span + span::before {
    content: none;
  }

  .legal-switcher {
    padding-bottom: var(--space-4);
  }
}
</style>
