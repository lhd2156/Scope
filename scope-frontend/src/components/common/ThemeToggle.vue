<template>
  <button
    type="button"
    class="theme-toggle theme-toggle--coming-soon"
    :aria-label="buttonLabel"
    :title="buttonLabel"
    aria-disabled="true"
  >
    <ScopeIcon :name="iconName" :label="buttonLabel" />
    <span class="theme-toggle__tooltip" role="tooltip">Coming soon</span>
  </button>
</template>

<script setup lang="ts">
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import { initializeTheme } from '@/utils/theme';

initializeTheme();

const iconName = 'sun';
const buttonLabel = 'Light mode coming soon';
</script>

<style scoped>
.theme-toggle {
  width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--glass-bg);
  color: var(--text-primary);
  cursor: default;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.theme-toggle:hover,
.theme-toggle:focus-visible {
  outline: none;
  transform: translateY(-0.0625rem);
  background: var(--bg-secondary);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
}

.theme-toggle__tooltip {
  position: absolute;
  top: calc(100% + 0.55rem);
  left: 50%;
  z-index: var(--z-tooltip, 30);
  width: max-content;
  max-width: 12rem;
  padding: 0.38rem 0.58rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 96%, transparent);
  color: var(--text-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -0.25rem);
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.theme-toggle__tooltip::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 0.45rem;
  height: 0.45rem;
  border-left: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-top: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: inherit;
  transform: translate(-50%, 50%) rotate(45deg);
}

.theme-toggle:hover .theme-toggle__tooltip,
.theme-toggle:focus-visible .theme-toggle__tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.theme-toggle :deep(.scope-icon) {
  width: 1.15rem;
  height: 1.15rem;
}
</style>
