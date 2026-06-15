<script setup lang="ts">
import { ref } from "vue";
import SiteBrand from "@/components/SiteBrand.vue";
import { navLinks } from "@/data";

const menuOpen = ref(false);
</script>

<template>
  <header class="site-header">
    <nav
      class="site-nav"
      aria-label="Main navigation"
    >
      <SiteBrand />
      <div
        class="nav-links"
        :class="{ open: menuOpen }"
      >
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          @click="menuOpen = false"
        >
          {{ link.label }}
        </RouterLink>
      </div>
      <RouterLink
        class="nav-cta"
        to="/download"
      >
        Open App
      </RouterLink>
      <button
        class="menu-button"
        type="button"
        @click="menuOpen = !menuOpen"
      >
        {{ menuOpen ? "Close" : "Menu" }}
      </button>
    </nav>
  </header>

  <RouterView />

  <footer class="site-footer">
    <div>
      <SiteBrand />
      <p>Real spots, smarter routes, and shareable trip plans for curious people.</p>
    </div>
    <div class="footer-links">
      <RouterLink to="/features">
        Features
      </RouterLink>
      <RouterLink to="/about">
        About
      </RouterLink>
      <RouterLink to="/privacy">
        Privacy
      </RouterLink>
      <RouterLink to="/terms">
        Terms
      </RouterLink>
    </div>
  </footer>
</template>
