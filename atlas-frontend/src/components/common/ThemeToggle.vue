<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="buttonLabel"
    :title="buttonLabel"
    @click="handleToggle"
  >
    <AtlasIcon :name="iconName" :label="buttonLabel" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import { initializeTheme, toggleTheme, useTheme } from '@/utils/theme';

initializeTheme();

const theme = useTheme();
const iconName = computed(() => (theme.value === 'dark' ? 'sun' : 'moon'));
const buttonLabel = computed(() => (theme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'));

function handleToggle() {
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
  transform: translateY(-0.0625rem);
  background: var(--bg-secondary);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
}

.theme-toggle :deep(.atlas-icon) {
  width: 1.15rem;
  height: 1.15rem;
}
</style>
