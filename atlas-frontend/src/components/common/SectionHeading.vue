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
  grid-template-columns: minmax(0, 1fr) minmax(0, 34rem);
  align-items: end;
  gap: clamp(var(--space-3), 1.5vw, var(--space-6));
  margin-bottom: var(--space-6);
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

h2 {
  margin: 0;
  font-size: var(--font-size-h2);
}

.description {
  max-width: 34rem;
  justify-self: end;
  margin: 0;
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
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
