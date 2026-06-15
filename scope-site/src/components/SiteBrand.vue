<script setup lang="ts">
const logoMarkSrc = "/branding/scope-trips-logo-mark.png";
</script>

<template>
  <RouterLink
    class="brand"
    to="/"
  >
    <span
      class="brand-mark"
      aria-hidden="true"
    >
      <img
        :src="logoMarkSrc"
        alt=""
      >
    </span>
    <span>Scope Trips</span>
  </RouterLink>
</template>
