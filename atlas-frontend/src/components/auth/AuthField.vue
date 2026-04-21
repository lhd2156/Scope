<template>
  <label class="auth-field" :for="inputId">
    <span class="auth-field__label">{{ label }}</span>

    <div class="auth-field__shell" :class="{ 'has-error': Boolean(error), 'has-trailing': Boolean(trailingIcon) }">
      <AtlasIcon class="auth-field__icon" :name="icon" :label="`${label} icon`" />
      <input
        :id="inputId"
        class="auth-field__input"
        :type="type"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :inputmode="inputmode"
        :spellcheck="spellcheck"
        :autocapitalize="autocapitalize"
        :autocorrect="autocorrect"
        :disabled="disabled"
        :value="modelValue"
        :aria-invalid="Boolean(error)"
        @input="handleInput"
      />
      <button
        v-if="trailingIcon"
        type="button"
        class="auth-field__toggle"
        :aria-label="trailingLabel || `${label} action`"
        @click="emit('trailing-click')"
      >
        <AtlasIcon :name="trailingIcon" :label="trailingLabel || `${label} action`" />
      </button>
    </div>

    <small v-if="error" class="auth-field__error">{{ error }}</small>
  </label>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';

withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    icon: string;
    type?: string;
    autocomplete?: string;
    placeholder?: string;
    maxlength?: number;
    error?: string;
    trailingIcon?: string;
    trailingLabel?: string;
    inputmode?: string;
    spellcheck?: boolean;
    autocapitalize?: string;
    autocorrect?: string;
    disabled?: boolean;
  }>(),
  {
    type: 'text',
    autocomplete: 'off',
    placeholder: '',
    error: '',
    trailingIcon: '',
    trailingLabel: '',
    inputmode: 'text',
    spellcheck: false,
    autocapitalize: 'off',
    autocorrect: 'off',
    disabled: false,
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'trailing-click'): void;
}>();

const generatedId = useId();
const inputId = computed(() => `auth-field-${generatedId}`);

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>

<style scoped>
.auth-field {
  display: grid;
  gap: var(--space-2);
}

.auth-field__label,
.auth-field__error {
  margin: 0;
}

.auth-field__label {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.auth-field__shell {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  padding: 0 1rem;
  min-height: 3.7rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, var(--input-border));
  border-radius: var(--radius-xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 84%, transparent), color-mix(in srgb, var(--bg-tertiary) 76%, transparent)),
    radial-gradient(circle at top, color-mix(in srgb, var(--accent-teal) 8%, transparent), transparent 58%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 5%, transparent),
    0 0.75rem 1.5rem color-mix(in srgb, var(--bg-primary) 10%, transparent);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast),
    background var(--transition-fast);
}

.auth-field__shell:focus-within {
  border-color: color-mix(in srgb, var(--accent-teal) 46%, var(--border));
  box-shadow:
    0 0 0 0.2rem color-mix(in srgb, var(--accent-teal) 18%, transparent),
    0 1rem 2rem color-mix(in srgb, var(--bg-primary) 16%, transparent);
  transform: translateY(-1px);
}

.auth-field__shell.has-error {
  border-color: color-mix(in srgb, var(--danger) 54%, var(--border));
}

.auth-field__shell.has-trailing {
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.auth-field__icon,
.auth-field__toggle :deep(.atlas-icon) {
  width: 1.1rem;
  height: 1.1rem;
}

.auth-field__icon {
  color: color-mix(in srgb, var(--accent-teal) 62%, var(--text-secondary));
}

.auth-field__input {
  width: 100%;
  padding: 1rem 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
}

.auth-field__input::placeholder {
  color: var(--input-placeholder);
}

.auth-field__input:focus {
  outline: none;
}

.auth-field__toggle {
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    transform var(--transition-fast);
}

.auth-field__toggle:hover,
.auth-field__toggle:focus-visible {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal) 14%, transparent);
  transform: translateY(-1px);
  outline: none;
}

.auth-field__toggle:active {
  transform: scale(0.97);
}

.auth-field__error {
  color: var(--danger);
  font-size: var(--font-size-caption);
}

@media (prefers-reduced-motion: reduce) {
  .auth-field__shell,
  .auth-field__toggle {
    transition: none;
  }
}
</style>
