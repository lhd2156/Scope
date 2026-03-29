<template>
  <div class="search-bar" role="search">
    <AtlasIcon name="search" label="Search" class="search-bar__icon" />
    <input
      :value="inputValue"
      :placeholder="placeholder"
      type="search"
      class="search-bar__input"
      :aria-label="resolvedAriaLabel"
      @input="handleInput"
      @keydown.enter.prevent="emitImmediately"
    />
    <button
      v-if="showClearButton"
      type="button"
      class="search-bar__clear"
      aria-label="Clear search"
      @click="clearSearch"
    >
      <AtlasIcon name="close" label="Clear search" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';

const MIN_SEARCH_DEBOUNCE_MS = 300;

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    ariaLabel?: string;
    label?: string;
    debounceMs?: number;
  }>(),
  {
    placeholder: 'Search Atlas',
    ariaLabel: undefined,
    label: undefined,
    debounceMs: MIN_SEARCH_DEBOUNCE_MS,
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'search', value: string): void;
}>();

const inputValue = ref(props.modelValue);
const effectiveDebounceMs = computed(() => Math.max(MIN_SEARCH_DEBOUNCE_MS, props.debounceMs));
const resolvedAriaLabel = computed(() => props.ariaLabel ?? props.label ?? 'Search Atlas');
const showClearButton = computed(() => Boolean(inputValue.value.trim().length));
let emitTimeoutId: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.modelValue,
  (nextValue) => {
    if (nextValue !== inputValue.value) {
      inputValue.value = nextValue;
    }
  },
);

function clearScheduledSearch() {
  if (emitTimeoutId !== null) {
    clearTimeout(emitTimeoutId);
    emitTimeoutId = null;
  }
}

function emitSearch(value: string) {
  const trimmedValue = value.trim();
  emit('update:modelValue', trimmedValue);
  emit('search', trimmedValue);
}

function scheduleSearch(value: string) {
  clearScheduledSearch();
  emitTimeoutId = setTimeout(() => {
    emitSearch(value);
    emitTimeoutId = null;
  }, effectiveDebounceMs.value);
}

function emitImmediately() {
  clearScheduledSearch();
  emitSearch(inputValue.value);
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  inputValue.value = target.value;
  scheduleSearch(inputValue.value);
}

function clearSearch() {
  inputValue.value = '';
  emitImmediately();
}

onBeforeUnmount(() => {
  clearScheduledSearch();
});
</script>

<style scoped>
.search-bar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
}

.search-bar:focus-within {
  border-color: var(--input-focus);
  box-shadow: var(--shadow-glow-teal);
}

.search-bar__icon,
.search-bar__clear {
  color: var(--text-secondary);
}

.search-bar__input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
}

.search-bar__input::placeholder {
  color: var(--text-muted);
}

.search-bar__input:focus {
  outline: none;
}

.search-bar__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.search-bar__clear:hover,
.search-bar__clear:focus-visible {
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
}
</style>
