<template>
  <section class="page-hero" :class="[`page-hero--${tone}`, { 'page-hero--centered': centered }]">
    <div class="page-hero__copy">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="description" class="page-hero__description">{{ description }}</p>
    </div>

    <div v-if="$slots.stats || $slots.actions" class="page-hero__aside">
      <div v-if="$slots.stats" class="page-hero__stats">
        <slot name="stats" />
      </div>
      <div v-if="$slots.actions" class="page-hero__actions">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.toolbar" class="page-hero__toolbar">
      <slot name="toolbar" />
    </div>

    <div v-if="$slots.footer" class="page-hero__footer">
      <slot name="footer" />
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    eyebrow?: string;
    description?: string;
    tone?: 'teal' | 'gold' | 'neutral';
    centered?: boolean;
  }>(),
  {
    eyebrow: undefined,
    description: undefined,
    tone: 'teal',
    centered: false,
  },
);
</script>

<style scoped>
.page-hero {
  position: relative;
  isolation: isolate;
  display: grid;
  gap: clamp(var(--space-5), 2.5vw, var(--space-6));
  padding: clamp(var(--space-6), 3vw, var(--space-8));
  border-radius: var(--radius-2xl);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 12%, var(--glass-border));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 38%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 96%, transparent), color-mix(in srgb, var(--bg-primary) 88%, var(--bg-secondary)));
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.page-hero--gold {
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-gold) 14%, transparent), transparent 36%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 96%, transparent), color-mix(in srgb, var(--bg-primary) 88%, var(--bg-secondary)));
}

.page-hero--neutral {
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 96%, transparent), color-mix(in srgb, var(--bg-primary) 90%, var(--bg-secondary)));
}

.page-hero::before {
  content: '';
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-teal) 32%, transparent), transparent);
  pointer-events: none;
}

.page-hero__copy {
  display: grid;
  gap: var(--space-3);
  max-width: var(--copy-measure-wide);
}

.page-hero__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-body);
  line-height: var(--line-height-normal);
}

h1 {
  margin: 0;
  font-size: var(--font-size-h1);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.eyebrow {
  margin: 0;
}

.page-hero__aside {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.page-hero__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.page-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-inline-start: auto;
}

.page-hero__toolbar,
.page-hero__footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.page-hero__footer {
  padding-block-start: var(--space-4);
  border-block-start: 1px solid color-mix(in srgb, var(--glass-border) 70%, transparent);
}

.page-hero--centered .page-hero__copy {
  justify-items: center;
  text-align: center;
  margin-inline: auto;
}

.page-hero--centered .page-hero__aside,
.page-hero--centered .page-hero__toolbar,
.page-hero--centered .page-hero__footer {
  justify-content: center;
}

@media (max-width: 720px) {
  .page-hero {
    padding: var(--space-5);
    gap: var(--space-4);
  }

  .page-hero__aside {
    align-items: flex-start;
  }

  .page-hero__actions {
    margin-inline-start: 0;
  }
}
</style>
