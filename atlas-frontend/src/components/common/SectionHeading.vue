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
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
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
  margin: 0;
  color: var(--text-secondary);
  text-align: right;
}

@media (max-width: 768px) {
  .section-heading {
    flex-direction: column;
    align-items: start;
  }

  .description {
    text-align: left;
  }
}
</style>
