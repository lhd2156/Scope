<template>
  <button
    :type="type"
    class="button atlas-button"
    :class="[`atlas-button--${variant}`, { 'atlas-button--block': block, 'is-loading': loading }]"
    :disabled="disabled || loading"
  >
    <LoadingSpinner v-if="loading" size="sm" :label="loadingLabel" />
    <AtlasIcon v-else-if="icon" :name="icon" :label="iconLabel" />
    <span><slot /></span>
  </button>
</template>

<script setup lang="ts">
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';

withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
    icon?: string;
    iconLabel?: string;
    loadingLabel?: string;
  }>(),
  {
    type: 'button',
    variant: 'primary',
    disabled: false,
    loading: false,
    block: false,
    icon: '',
    iconLabel: '',
    loadingLabel: 'Submitting',
  },
);
</script>

<style scoped>
.atlas-button {
  border: 0;
  cursor: pointer;
}

.atlas-button--primary {
  background: var(--accent-teal);
  color: var(--bg-primary);
}

.atlas-button--primary:hover,
.atlas-button--primary:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-glow-teal);
}

.atlas-button--secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.atlas-button--secondary:hover,
.atlas-button--secondary:focus-visible {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.atlas-button--danger {
  background: var(--danger);
  color: var(--text-primary);
}

.atlas-button--danger:hover,
.atlas-button--danger:focus-visible {
  background: var(--danger-hover);
  box-shadow: 0 0 0.85rem color-mix(in srgb, var(--danger) 32%, transparent);
}

.atlas-button--block {
  width: 100%;
}

.atlas-button:disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
  box-shadow: none;
}

.atlas-button :deep(.atlas-icon),
.atlas-button :deep(.loading-spinner) {
  width: 1rem;
  height: 1rem;
}
</style>
