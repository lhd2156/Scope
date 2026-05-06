<template>
  <button
    :type="type"
    class="button scope-button"
    :class="[`scope-button--${variant}`, { 'scope-button--block': block, 'is-loading': loading }]"
    :disabled="disabled || loading"
  >
    <LoadingSpinner v-if="loading" size="sm" :label="loadingLabel" />
    <ScopeIcon v-else-if="icon" :name="icon" :label="iconLabel" />
    <span><slot /></span>
  </button>
</template>

<script setup lang="ts">
import ScopeIcon from '@/components/common/ScopeIcon.vue';
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
.scope-button {
  border: 0;
  cursor: pointer;
}

.scope-button--primary {
  background: var(--accent-teal);
  color: var(--bg-primary);
}

.scope-button--primary:hover,
.scope-button--primary:focus-visible {
  background: var(--accent-teal-hover);
}

.scope-button--secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.scope-button--secondary:hover,
.scope-button--secondary:focus-visible {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.scope-button--danger {
  background: var(--danger);
  color: var(--text-primary);
}

.scope-button--danger:hover,
.scope-button--danger:focus-visible {
  background: var(--danger-hover);
  box-shadow: var(--shadow-sm);
}

.scope-button--block {
  width: 100%;
}

.scope-button:disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
  box-shadow: none;
}

.scope-button :deep(.scope-icon),
.scope-button :deep(.loading-spinner) {
  width: 1rem;
  height: 1rem;
}
</style>
