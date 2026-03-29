<template>
  <article
    class="empty-state-panel"
    :class="[`empty-state-panel--${tone}`, { 'empty-state-panel--compact': compact }]"
    data-test="empty-state-panel"
    role="status"
    aria-live="polite"
  >
    <div class="empty-state-panel__icon" aria-hidden="true">
      <AtlasIcon :name="icon" />
    </div>

    <div class="empty-state-panel__copy">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <component :is="headingLevel" class="empty-state-panel__title">{{ title }}</component>
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
import AtlasIcon from '@/components/common/AtlasIcon.vue';

withDefaults(
  defineProps<{
    title: string;
    description: string;
    eyebrow?: string;
    icon?: string;
    tone?: 'glass' | 'surface';
    headingLevel?: 'h2' | 'h3' | 'h4';
    compact?: boolean;
  }>(),
  {
    eyebrow: undefined,
    icon: 'sparkle',
    tone: 'glass',
    headingLevel: 'h3',
    compact: false,
  },
);
</script>

<style scoped>
.empty-state-panel {
  display: grid;
  gap: var(--space-4);
  justify-items: start;
  padding: var(--space-5);
  border-radius: var(--radius-2xl);
  border: 1px solid transparent;
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
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
}

.empty-state-panel__icon {
  width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--accent-teal-light);
  color: var(--accent-teal);
  font-size: 1.25rem;
}

.empty-state-panel__copy {
  display: grid;
  gap: var(--space-2);
}

.eyebrow,
.empty-state-panel__title,
.empty-state-panel__description {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.empty-state-panel__title {
  color: var(--text-primary);
  line-height: var(--line-height-tight);
}

.empty-state-panel__description {
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.empty-state-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.empty-state-panel__actions :deep(.button) {
  width: fit-content;
}

@media (max-width: 720px) {
  .empty-state-panel,
  .empty-state-panel--compact {
    padding: var(--space-4);
  }

  .empty-state-panel__actions {
    width: 100%;
  }

  .empty-state-panel__actions :deep(.button) {
    width: 100%;
  }
}
</style>
