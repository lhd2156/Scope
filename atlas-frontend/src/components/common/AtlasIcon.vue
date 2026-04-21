<template>
  <svg
    class="atlas-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="label ? 'img' : 'presentation'"
    :aria-hidden="label ? 'false' : 'true'"
  >
    <title v-if="label">{{ label }}</title>
    <use :href="iconHref" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  name: string;
  label?: string;
}>();

const iconHref = computed(() => `/atlas-icons.svg#icon-${props.name}`);
</script>

<style scoped>
.atlas-icon {
  width: 1em;
  height: 1em;
  display: block;
  flex-shrink: 0;
}
</style>
