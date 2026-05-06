<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <section class="glass-panel admin-card">
    <p class="eyebrow">Scope Admin</p>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
  </section>
</template>
