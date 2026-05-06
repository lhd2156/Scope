<template>
  <section class="sidebar glass-panel" :class="{ 'is-collapsed': collapsedState }">
    <header class="sidebar-header">
      <div>
        <p v-if="eyebrow" class="sidebar-eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
      </div>
      <div class="sidebar-actions">
        <slot name="actions" />
        <button
          v-if="collapsible"
          type="button"
          class="sidebar-toggle"
          :aria-expanded="String(!collapsedState)"
          @click="toggleCollapsed"
        >
          <ScopeIcon :name="collapsedState ? 'menu' : 'close'" :label="collapsedState ? 'Open sidebar' : 'Collapse sidebar'" />
        </button>
      </div>
    </header>

    <div v-show="!collapsedState" class="sidebar-body">
      <slot />
    </div>

    <footer v-if="$slots.footer && !collapsedState" class="sidebar-footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    eyebrow?: string;
    collapsible?: boolean;
    collapsed?: boolean;
  }>(),
  {
    eyebrow: '',
    collapsible: false,
    collapsed: false,
  },
);

const emit = defineEmits<{
  (event: 'update:collapsed', value: boolean): void;
}>();

const collapsedState = ref(props.collapsed);

watch(
  () => props.collapsed,
  (nextValue) => {
    collapsedState.value = nextValue;
  },
);

function toggleCollapsed() {
  collapsedState.value = !collapsedState.value;
  emit('update:collapsed', collapsedState.value);
}
</script>

<style scoped>
.sidebar {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
}

.sidebar.is-collapsed {
  gap: 0;
}

.sidebar-header,
.sidebar-actions {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
}

.sidebar-header h2,
.sidebar-eyebrow {
  margin: 0;
}

.sidebar-eyebrow {
  margin-bottom: var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.sidebar-body,
.sidebar-footer {
  display: grid;
  gap: var(--space-4);
}

.sidebar-toggle {
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast),
    border-color var(--transition-fast);
}

.sidebar-toggle:hover,
.sidebar-toggle:focus-visible {
  background: var(--accent-teal-light);
  border-color: var(--accent-teal);
  transform: translateY(-0.0625rem);
  outline: none;
}
</style>
