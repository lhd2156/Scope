<script setup lang="ts">
import { ref } from "vue";
import { navLinks } from "@/data";

const menuOpen = ref(false);
</script>

<template>
  <header class="site-header">
    <nav class="site-nav" aria-label="Main navigation">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">AT</span>
        <span>Scope</span>
      </RouterLink>
      <div class="nav-links" :class="{ open: menuOpen }">
        <RouterLink v-for="link in navLinks" :key="link.to" :to="link.to" @click="menuOpen = false">
          {{ link.label }}
        </RouterLink>
      </div>
      <RouterLink class="nav-cta" to="/download">Launch Web App</RouterLink>
      <button class="menu-button" type="button" @click="menuOpen = !menuOpen">
        {{ menuOpen ? "Close" : "Menu" }}
      </button>
    </nav>
  </header>

  <RouterView />

  <footer class="site-footer">
    <div>
      <RouterLink class="brand" to="/">
        <span class="brand-mark">AT</span>
        <span>Scope</span>
      </RouterLink>
      <p>Real places, real photos, real adventures on a map-first platform for curious people.</p>
    </div>
    <div class="footer-links">
      <RouterLink to="/features">Features</RouterLink>
      <RouterLink to="/about">About</RouterLink>
      <RouterLink to="/privacy">Privacy</RouterLink>
      <RouterLink to="/terms">Terms</RouterLink>
    </div>
  </footer>
</template>
