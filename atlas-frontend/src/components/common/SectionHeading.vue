<template>
  <div class="section-heading">
    <div>
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h2>{{ title }}</h2>
    </div>
    <p v-if="description" class="description">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  eyebrow?: string;
  description?: string;
}>();
</script>

<style scoped>
.section-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, var(--copy-measure));
  align-items: end;
  gap: clamp(var(--space-3), 1.5vw, var(--space-6));
  margin-bottom: var(--section-gap-compact);
}

.eyebrow {
  margin-bottom: var(--space-2);
}

h2 {
  margin: 0;
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
}

.description {
  margin: 0;
  max-width: var(--copy-measure);
  justify-self: end;
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

@media (max-width: 1100px) {
  .section-heading {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .description {
    max-width: 100%;
    justify-self: start;
  }
}
</style>
