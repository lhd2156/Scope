<template>
  <header class="navbar glass-panel">
    <RouterLink to="/" class="brand">Atlas</RouterLink>
    <nav>
      <RouterLink to="/explore">Explore</RouterLink>
      <RouterLink to="/map">Map</RouterLink>
      <RouterLink to="/trips/new">Trips</RouterLink>
      <RouterLink to="/friends">Friends</RouterLink>
    </nav>
    <div class="actions">
      <ThemeToggle />
      <RouterLink to="/profile/user-1">Profile</RouterLink>
    </div>
  </header>
</template>
<script setup lang="ts">
import ThemeToggle from './ThemeToggle.vue';
</script>
<style scoped>
.navbar{position:fixed;inset:1rem 1rem auto;z-index:var(--z-navbar);display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem}.brand{font-weight:var(--font-weight-bold)}nav,.actions{display:flex;gap:1rem;align-items:center}@media (max-width:768px){nav{display:none}}
</style>
