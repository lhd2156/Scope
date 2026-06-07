<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="buttonLabel"
    :title="buttonLabel"
    @click="handleToggle"
  >
    <ScopeIcon :name="iconName" :label="buttonLabel" />
    <span class="theme-toggle__tooltip" role="status">{{ tooltipCopy }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import { initializeTheme, toggleTheme, useTheme } from '@/utils/theme';

initializeTheme();

const theme = useTheme();
const iconName = computed(() => (theme.value === 'dark' ? 'sun' : 'moon'));
const nextThemeLabel = computed(() => (theme.value === 'dark' ? 'light' : 'dark'));
const activeThemeLabel = computed(() => (theme.value === 'dark' ? 'Dark' : 'Light'));
const tooltipCopy = computed(() => `Switch to ${nextThemeLabel.value} mode`);
const buttonLabel = computed(() => `${activeThemeLabel.value} theme active. ${tooltipCopy.value}.`);

function handleToggle(): void {
  toggleTheme('navbar');
}
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
  cursor: pointer;
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
  background: var(--bg-secondary);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
}

.theme-toggle :deep(.scope-icon) {
  width: 1.15rem;
  height: 1.15rem;
}

.theme-toggle__tooltip {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  z-index: calc(var(--z-dropdown) + 1);
  width: max-content;
  max-width: 13rem;
  padding: 0.48rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 28%, var(--glass-border));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-secondary) 98%, transparent);
  color: var(--text-primary);
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 8%, transparent);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-0.2rem);
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
  white-space: nowrap;
}

.theme-toggle__tooltip::before {
  content: '';
  position: absolute;
  top: -0.3rem;
  right: 0.95rem;
  width: 0.55rem;
  height: 0.55rem;
  border-top: 1px solid color-mix(in srgb, var(--accent-teal) 28%, var(--glass-border));
  border-left: 1px solid color-mix(in srgb, var(--accent-teal) 28%, var(--glass-border));
  background: inherit;
  transform: rotate(45deg);
}

.theme-toggle:hover .theme-toggle__tooltip,
.theme-toggle:focus-visible .theme-toggle__tooltip {
  opacity: 1;
  transform: translateY(0);
}

@media (max-width: 640px) {
  .theme-toggle__tooltip {
    right: 50%;
    transform: translate(50%, -0.2rem);
  }

  .theme-toggle__tooltip::before {
    right: calc(50% - 0.275rem);
  }

  .theme-toggle:hover .theme-toggle__tooltip,
  .theme-toggle:focus-visible .theme-toggle__tooltip {
    transform: translate(50%, 0);
  }
}
</style>
