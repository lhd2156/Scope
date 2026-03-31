<template>
  <article
    class="empty-state-panel"
    :class="[
      `empty-state-panel--${tone}`,
      `empty-state-panel--artwork-${artwork}`,
      `empty-state-panel--align-${alignment}`,
      { 'empty-state-panel--compact': compact },
    ]"
    data-test="empty-state-panel"
    role="status"
    aria-live="polite"
  >
    <div class="empty-state-panel__art" data-test="empty-state-artwork" aria-hidden="true">
      <span class="empty-state-panel__art-backdrop" />
      <span class="empty-state-panel__art-grid" />

      <div class="empty-state-panel__orbit empty-state-panel__orbit--top">
        <AtlasIcon :name="artworkMeta.secondaryIcons[0]" />
      </div>
      <div class="empty-state-panel__orbit empty-state-panel__orbit--bottom">
        <AtlasIcon :name="artworkMeta.secondaryIcons[1]" />
      </div>

      <div class="empty-state-panel__hero-medallion">
        <span class="empty-state-panel__hero-ring" />
        <div class="empty-state-panel__hero-icon">
          <AtlasIcon :name="artworkMeta.primaryIcon" />
        </div>
        <span class="empty-state-panel__spark empty-state-panel__spark--a" />
        <span class="empty-state-panel__spark empty-state-panel__spark--b" />
      </div>

      <div class="empty-state-panel__pill-row">
        <span
          v-for="pill in artworkMeta.pills"
          :key="pill"
          class="empty-state-panel__pill"
          data-test="empty-state-pill"
        >
          {{ pill }}
        </span>
      </div>
    </div>

    <div class="empty-state-panel__copy">
      <div class="empty-state-panel__copy-header">
        <div class="empty-state-panel__icon" aria-hidden="true">
          <AtlasIcon :name="resolvedLeadIcon" />
        </div>

        <div class="empty-state-panel__heading-group">
          <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
          <component :is="headingLevel" class="empty-state-panel__title">{{ title }}</component>
        </div>
      </div>

      <p class="empty-state-panel__description">{{ description }}</p>
    </div>

    <div v-if="$slots.default || $slots.actions" class="empty-state-panel__actions">
      <slot name="actions">
        <slot />
      </slot>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';

const EMPTY_STATE_ARTWORKS = {
  generic: {
    primaryIcon: 'sparkle',
    secondaryIcons: ['map', 'pin'],
    pills: ['Fresh start', 'Atlas ready'],
  },
  activity: {
    primaryIcon: 'sparkle',
    secondaryIcons: ['heart', 'pin'],
    pills: ['Pins', 'Trips', 'Updates'],
  },
  discovery: {
    primaryIcon: 'search',
    secondaryIcons: ['map', 'pin'],
    pills: ['Cities', 'Vibes', 'Highlights'],
  },
  community: {
    primaryIcon: 'friends',
    secondaryIcons: ['route', 'sparkle'],
    pills: ['Crew', 'Intros', 'Shared routes'],
  },
  profile: {
    primaryIcon: 'user',
    secondaryIcons: ['map', 'route'],
    pills: ['Footprint', 'Pins', 'Moments'],
  },
  itinerary: {
    primaryIcon: 'route',
    secondaryIcons: ['map', 'sparkle'],
    pills: ['Stops', 'Timeline', 'Budget'],
  },
  notification: {
    primaryIcon: 'bell',
    secondaryIcons: ['friends', 'sparkle'],
    pills: ['Invites', 'Comments', 'Remixes'],
  },
} as const;

type EmptyStateArtwork = keyof typeof EMPTY_STATE_ARTWORKS;

const props = withDefaults(
  defineProps<{
    title: string;
    description: string;
    eyebrow?: string;
    icon?: string;
    tone?: 'glass' | 'surface';
    headingLevel?: 'h1' | 'h2' | 'h3' | 'h4';
    compact?: boolean;
    artwork?: EmptyStateArtwork;
    alignment?: 'start' | 'center';
  }>(),
  {
    eyebrow: undefined,
    icon: undefined,
    tone: 'glass',
    headingLevel: 'h3',
    compact: false,
    artwork: 'generic',
    alignment: 'start',
  },
);

const artworkMeta = computed(() => EMPTY_STATE_ARTWORKS[props.artwork]);
const resolvedLeadIcon = computed(() => props.icon ?? artworkMeta.value.primaryIcon);
</script>

<style scoped>
.empty-state-panel {
  --empty-state-accent: var(--accent-teal);
  --empty-state-secondary: var(--accent-gold);
  position: relative;
  display: grid;
  gap: var(--space-5);
  justify-items: start;
  padding: var(--space-5);
  border-radius: var(--radius-2xl);
  border: 1px solid transparent;
  overflow: hidden;
}

.empty-state-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--empty-state-accent) 14%, transparent), transparent 38%),
    radial-gradient(circle at bottom right, color-mix(in srgb, var(--empty-state-secondary) 12%, transparent), transparent 34%),
    linear-gradient(160deg, color-mix(in srgb, var(--text-primary) 4%, transparent), transparent 36%);
  pointer-events: none;
}

.empty-state-panel > * {
  position: relative;
  z-index: 1;
}

.empty-state-panel--glass {
  background: var(--glass-bg);
  border-color: var(--glass-border);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-md);
}

.empty-state-panel--surface {
  background: var(--bg-secondary);
  border-color: var(--border);
  box-shadow: var(--shadow-sm);
}

.empty-state-panel--compact {
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
}

.empty-state-panel--align-center {
  justify-items: center;
  text-align: center;
}

.empty-state-panel--align-center .empty-state-panel__copy,
.empty-state-panel--align-center .empty-state-panel__copy-header,
.empty-state-panel--align-center .empty-state-panel__heading-group,
.empty-state-panel--align-center .empty-state-panel__actions {
  justify-items: center;
  justify-content: center;
}

.empty-state-panel--align-center .empty-state-panel__copy-header {
  grid-template-columns: 1fr;
}

.empty-state-panel--align-center .empty-state-panel__actions {
  justify-content: center;
}

.empty-state-panel--artwork-activity {
  --empty-state-accent: var(--accent-teal);
  --empty-state-secondary: var(--accent-gold);
}

.empty-state-panel--artwork-discovery {
  --empty-state-accent: var(--info);
  --empty-state-secondary: var(--accent-teal);
}

.empty-state-panel--artwork-community {
  --empty-state-accent: var(--accent-teal);
  --empty-state-secondary: var(--info);
}

.empty-state-panel--artwork-profile {
  --empty-state-accent: var(--accent-gold);
  --empty-state-secondary: var(--accent-teal);
}

.empty-state-panel--artwork-itinerary {
  --empty-state-accent: var(--accent-teal);
  --empty-state-secondary: var(--accent-gold);
}

.empty-state-panel--artwork-notification {
  --empty-state-accent: var(--info);
  --empty-state-secondary: var(--accent-teal);
}

.empty-state-panel__art,
.empty-state-panel__copy,
.empty-state-panel__heading-group,
.empty-state-panel__actions {
  display: grid;
}

.empty-state-panel__art {
  position: relative;
  width: min(100%, 21rem);
  min-height: 12.5rem;
  padding: var(--space-4);
  align-items: end;
  border-radius: calc(var(--radius-2xl) - var(--space-1));
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 74%, transparent), color-mix(in srgb, var(--bg-primary) 54%, transparent));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 10%, transparent),
    0 1rem 2rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
}

.empty-state-panel--compact .empty-state-panel__art {
  width: min(100%, 18rem);
  min-height: 10.75rem;
}

.empty-state-panel__art-backdrop,
.empty-state-panel__art-grid,
.empty-state-panel__hero-ring,
.empty-state-panel__spark,
.empty-state-panel__orbit {
  position: absolute;
}

.empty-state-panel__art-backdrop {
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 22% 20%, color-mix(in srgb, var(--empty-state-accent) 26%, transparent), transparent 34%),
    radial-gradient(circle at 78% 18%, color-mix(in srgb, var(--empty-state-secondary) 18%, transparent), transparent 30%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 14%, transparent), transparent 40%);
}

.empty-state-panel__art-grid {
  inset: var(--space-3);
  border-radius: calc(var(--radius-xl) - var(--space-1));
  border: 1px dashed color-mix(in srgb, var(--glass-border) 80%, transparent);
  opacity: 0.72;
}

.empty-state-panel__hero-medallion {
  position: relative;
  display: grid;
  place-items: center;
  width: 6.6rem;
  aspect-ratio: 1;
  margin-inline: auto;
  border-radius: var(--radius-full);
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--text-primary) 14%, transparent), transparent 54%),
    linear-gradient(180deg, color-mix(in srgb, var(--empty-state-accent) 28%, var(--bg-secondary)), color-mix(in srgb, var(--bg-primary) 70%, transparent));
  box-shadow:
    0 1rem 1.8rem color-mix(in srgb, var(--bg-primary) 22%, transparent),
    0 0 0 1px color-mix(in srgb, var(--glass-border) 100%, transparent),
    0 0 2rem color-mix(in srgb, var(--empty-state-accent) 18%, transparent);
}

.empty-state-panel--compact .empty-state-panel__hero-medallion {
  width: 5.6rem;
}

.empty-state-panel__hero-ring {
  inset: -0.55rem;
  border-radius: inherit;
  border: 1px solid color-mix(in srgb, var(--empty-state-secondary) 34%, transparent);
  opacity: 0.85;
}

.empty-state-panel__hero-icon {
  display: inline-grid;
  place-items: center;
  width: 3.2rem;
  height: 3.2rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 36%, transparent);
  color: var(--text-primary);
}

.empty-state-panel__hero-icon :deep(.atlas-icon) {
  width: 1.5rem;
  height: 1.5rem;
}

.empty-state-panel__spark {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--text-primary) 78%, transparent);
  box-shadow: 0 0 1rem color-mix(in srgb, var(--text-primary) 24%, transparent);
}

.empty-state-panel__spark--a {
  top: 0.85rem;
  right: 0.55rem;
}

.empty-state-panel__spark--b {
  left: 0.4rem;
  bottom: 1rem;
  width: 0.55rem;
  height: 0.55rem;
  background: color-mix(in srgb, var(--empty-state-secondary) 64%, transparent);
}

.empty-state-panel__orbit {
  display: inline-grid;
  place-items: center;
  width: 2.85rem;
  height: 2.85rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 24%, transparent);
  color: color-mix(in srgb, var(--empty-state-accent) 88%, var(--text-primary));
  box-shadow: var(--shadow-sm);
}

.empty-state-panel__orbit :deep(.atlas-icon) {
  width: 1.1rem;
  height: 1.1rem;
}

.empty-state-panel__orbit--top {
  top: var(--space-3);
  left: var(--space-4);
}

.empty-state-panel__orbit--bottom {
  right: var(--space-4);
  bottom: 3.2rem;
  color: color-mix(in srgb, var(--empty-state-secondary) 78%, var(--text-primary));
}

.empty-state-panel__pill-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.empty-state-panel__pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.8rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.empty-state-panel__copy {
  gap: var(--space-3);
}

.empty-state-panel__copy-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
}

.empty-state-panel__heading-group {
  gap: var(--space-2);
}

.empty-state-panel__icon {
  width: 2.9rem;
  height: 2.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--empty-state-accent) 16%, var(--bg-secondary));
  color: color-mix(in srgb, var(--empty-state-accent) 88%, var(--text-primary));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--empty-state-accent) 22%, transparent),
    var(--shadow-sm);
}

.empty-state-panel__copy-header :deep(.atlas-icon) {
  width: 1.2rem;
  height: 1.2rem;
}

.eyebrow,
.empty-state-panel__title,
.empty-state-panel__description {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
}

.empty-state-panel__title {
  color: var(--text-primary);
  line-height: var(--line-height-tight);
}

h1.empty-state-panel__title {
  font-size: clamp(var(--font-size-h2), 3vw, var(--font-size-h1));
}

h2.empty-state-panel__title {
  font-size: clamp(var(--font-size-h3), 2.4vw, var(--font-size-h2));
}

h3.empty-state-panel__title,
h4.empty-state-panel__title {
  font-size: var(--font-size-h3);
}

.empty-state-panel__description {
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
  max-width: var(--copy-measure);
}

.empty-state-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.empty-state-panel__actions :deep(.button) {
  width: fit-content;
}

@media (prefers-reduced-motion: no-preference) {
  .empty-state-panel__hero-medallion {
    animation: empty-state-float 3.2s ease-in-out infinite;
  }

  .empty-state-panel__orbit--top {
    animation: empty-state-orbit-left 4.6s ease-in-out infinite;
  }

  .empty-state-panel__orbit--bottom {
    animation: empty-state-orbit-right 5.2s ease-in-out infinite;
  }
}

@media (max-width: 720px) {
  .empty-state-panel,
  .empty-state-panel--compact {
    padding: var(--space-4);
  }

  .empty-state-panel__art,
  .empty-state-panel--compact .empty-state-panel__art {
    width: 100%;
  }

  .empty-state-panel__actions {
    width: 100%;
  }

  .empty-state-panel__actions :deep(.button) {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .empty-state-panel__hero-medallion,
  .empty-state-panel__orbit--top,
  .empty-state-panel__orbit--bottom {
    animation: none;
  }
}

@keyframes empty-state-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-0.3rem);
  }
}

@keyframes empty-state-orbit-left {
  0%,
  100% {
    transform: translateY(0) translateX(0);
  }

  50% {
    transform: translateY(-0.2rem) translateX(0.15rem);
  }
}

@keyframes empty-state-orbit-right {
  0%,
  100% {
    transform: translateY(0) translateX(0);
  }

  50% {
    transform: translateY(0.22rem) translateX(-0.14rem);
  }
}
</style>
