<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="buttonLabel"
    :title="buttonLabel"
    aria-disabled="true"
  >
    <ScopeIcon :name="iconName" :label="buttonLabel" />
  </button>
</template>

<script setup lang="ts">
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import { initializeTheme } from '@/utils/theme';

initializeTheme();

const iconName = 'moon';
const buttonLabel = 'Dark theme active';
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
</style>
