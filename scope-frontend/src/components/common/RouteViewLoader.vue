<template>
  <div class="route-view-loader" role="status" aria-live="polite">
    <LoadingSpinner size="lg" label="Loading Scope page" />
    <div class="route-view-loader__copy">
      <strong>Loading Scope workspace…</strong>
      <p>Preparing the next route view.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
</script>

<style scoped>
.route-view-loader {
  min-height: calc(100vh - 8rem);
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--space-4);
  padding: var(--space-8);
  color: var(--text-primary);
}

.route-view-loader__copy {
  display: grid;
  gap: var(--space-2);
  text-align: center;
}

.route-view-loader__copy strong,
.route-view-loader__copy p {
  margin: 0;
}

.route-view-loader__copy p {
  color: var(--text-secondary);
}
</style>
