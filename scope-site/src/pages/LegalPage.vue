<script setup lang="ts">
defineProps<{
  kind: "privacy" | "terms";
}>();
</script>

<template>
  <main class="section padded-top">
    <article class="card article-card">
      <p class="eyebrow">Scope</p>
      <h1>{{ kind === 'privacy' ? 'Privacy' : 'Terms' }}</h1>
      <p>
        Scope is a portfolio application for real-world adventure discovery. Production deployments
        should connect this page to the final legal policy approved for the hosted environment.
      </p>
    </article>
  </main>
</template>
