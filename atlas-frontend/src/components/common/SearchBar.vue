<template>
  <label class="search-bar" :class="{ 'search-bar--compact': compact }">
    <span class="search-bar__label">{{ label }}</span>
    <div class="search-bar__field">
      <AtlasIcon name="search" label="Search" />
      <input
        :value="inputValue"
        :type="type"
        :placeholder="placeholder"
        :aria-label="label"
        :maxlength="maxlength"
        @input="handleInput"
        @keydown.enter.prevent="emitImmediately"
      />
      <button
        v-if="clearable && inputValue"
        type="button"
        class="search-bar__clear"
        aria-label="Clear search"
        @click="clearSearch"
      >
        <AtlasIcon name="close" label="Clear search" />
      </button>
    </div>
  </label>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { ref, watch } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    label?: string;
    placeholder?: string;
    debounceMs?: number;
    clearable?: boolean;
    compact?: boolean;
    type?: 'search' | 'text';
    maxlength?: number;
  }>(),
  {
    modelValue: '',
    label: 'Search',
    placeholder: 'Search',
    debounceMs: 300,
    clearable: true,
    compact: false,
    type: 'search',
    maxlength: 120,
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'search', value: string): void;
}>();

const inputValue = ref(props.modelValue);

watch(
  () => props.modelValue,
  (nextValue) => {
    if (nextValue !== inputValue.value) {
      inputValue.value = nextValue;
    }
  },
);

const emitSearch = useDebounceFn((value: string) => {
  const trimmedValue = value.trim();
  emit('update:modelValue', trimmedValue);
  emit('search', trimmedValue);
}, props.debounceMs);

function emitImmediately() {
  emitSearch.cancel();
  const trimmedValue = inputValue.value.trim();
  emit('update:modelValue', trimmedValue);
  emit('search', trimmedValue);
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  inputValue.value = target.value;
  emitSearch(inputValue.value);
}

function clearSearch() {
  inputValue.value = '';
  emitImmediately();
}
</script>

<style scoped>
.search-bar {
  display: grid;
  gap: var(--space-2);
}

.search-bar__label {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.search-bar__field {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  padding: 0.78rem 0.95rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.search-bar__field:focus-within {
  border-color: var(--input-focus);
  box-shadow: var(--shadow-glow-teal);
}

.search-bar__field :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--text-secondary);
}

.search-bar input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
}

.search-bar input:focus {
  outline: none;
}

.search-bar input::placeholder {
  color: var(--input-placeholder);
}

.search-bar__clear {
  width: 1.75rem;
  height: 1.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.search-bar__clear:hover,
.search-bar__clear:focus-visible {
  background: var(--accent-teal-light);
  color: var(--text-primary);
  outline: none;
}

.search-bar--compact {
  gap: var(--space-1);
}

.search-bar--compact .search-bar__label {
  font-size: var(--font-size-caption);
}

.search-bar--compact .search-bar__field {
  padding-block: 0.68rem;
}
</style>
