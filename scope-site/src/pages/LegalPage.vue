<script setup lang="ts">
defineProps<{
  kind: "privacy" | "terms";
}>();
</script>

<template>
  <main class="section padded-top">
    <article class="card article-card">
      <p class="eyebrow">
        Scope Trips
      </p>
      <h1>{{ kind === 'privacy' ? 'Privacy' : 'Terms' }}</h1>
      <p>
        Scope Trips is a portfolio application for real-world trip discovery. Production deployments
        should connect this page to the final legal policy approved for the hosted environment.
      </p>
    </article>
  </main>
</template>
