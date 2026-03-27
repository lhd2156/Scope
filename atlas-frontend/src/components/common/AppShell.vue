<template>
  <div class="layout-shell">
    <Navbar />
    <main><slot /></main>
  </div>
</template>
<script setup lang="ts">
import Navbar from './Navbar.vue';
</script>
