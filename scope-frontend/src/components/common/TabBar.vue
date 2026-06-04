<template>
  <div
    class="tab-bar"
    :class="[`tab-bar--${variant}`, { 'tab-bar--full': fullWidth }]"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :data-test="tab.dataTest ?? `tab-${tab.id}`"
      type="button"
      role="tab"
      class="tab-bar__item"
      :class="{ 'is-active': modelValue === tab.id, 'is-disabled': tab.disabled }"
      :aria-selected="modelValue === tab.id"
      :aria-controls="tab.panelId"
      :disabled="tab.disabled"
      @click="select(tab)"
    >
      <span v-if="tab.icon" class="tab-bar__icon" aria-hidden="true">{{ tab.icon }}</span>
      <span class="tab-bar__label">{{ tab.label }}</span>
      <span v-if="tab.count !== undefined" class="tab-bar__count">{{ tab.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
export interface TabBarItem<TId extends string = string> {
  id: TId;
  label: string;
  count?: number;
  icon?: string;
  disabled?: boolean;
  panelId?: string;
  dataTest?: string;
}

withDefaults(
  defineProps<{
    modelValue: T;
    tabs: TabBarItem<T>[];
    ariaLabel?: string;
    variant?: 'pills' | 'underline' | 'segmented';
    fullWidth?: boolean;
  }>(),
  {
    ariaLabel: 'Sections',
    variant: 'pills',
    fullWidth: false,
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: T): void;
  (event: 'change', value: T): void;
}>();

function select(tab: TabBarItem<T>) {
  if (tab.disabled) {
    return;
  }
  emit('update:modelValue', tab.id);
  emit('change', tab.id);
}
</script>

<style scoped>
.tab-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: 0.4rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-tertiary) 76%, var(--bg-primary));
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 5%, transparent);
}

.tab-bar--underline {
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
  border-block-end: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  border-radius: 0;
  gap: var(--space-4);
}

.tab-bar--segmented {
  width: 100%;
  border-radius: var(--radius-xl);
}

.tab-bar--full {
  width: 100%;
}

.tab-bar__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0.65rem 1.05rem;
  border-radius: var(--radius-full);
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.tab-bar--full .tab-bar__item {
  flex: 1;
  min-width: 0;
}

.tab-bar__item:hover:not(.is-disabled),
.tab-bar__item:focus-visible:not(.is-disabled) {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-secondary) 80%, transparent);
  outline: none;
}

.tab-bar__item.is-active {
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  color: var(--text-primary);
  box-shadow:
    0 1px 0 color-mix(in srgb, var(--text-primary) 6%, transparent) inset,
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 38%, transparent);
}

.tab-bar__item.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.tab-bar__item:active:not(.is-disabled) {
  transform: scale(var(--motion-press-scale));
}

.tab-bar__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 0.4rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal-light) 90%, transparent);
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.tab-bar__item.is-active .tab-bar__count {
  background: color-mix(in srgb, var(--accent-teal) 32%, var(--bg-secondary));
  color: var(--text-primary);
}

.tab-bar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-tertiary));
  color: var(--accent-teal);
  font-size: 0.85rem;
  font-weight: var(--font-weight-bold);
}

/* Underline variant: classic underlined nav, no background change */
.tab-bar--underline .tab-bar__item {
  position: relative;
  padding: 0.65rem 0;
  border-radius: 0;
  background: transparent;
}

.tab-bar--underline .tab-bar__item::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  opacity: 0;
  transform: scaleX(0);
  transform-origin: left;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.tab-bar--underline .tab-bar__item.is-active {
  background: transparent;
  box-shadow: none;
  color: var(--text-primary);
}

.tab-bar--underline .tab-bar__item.is-active::after {
  opacity: 1;
  transform: scaleX(1);
}

@media (max-width: 720px) {
  .tab-bar {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding: 0.35rem;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab-bar__item {
    flex: 0 0 auto;
    scroll-snap-align: start;
  }

  .tab-bar--underline {
    overflow-x: auto;
  }
}
</style>
