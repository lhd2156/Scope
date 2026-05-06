<script setup lang="ts">
import { posts } from "@/data";
</script>

<template>
  <main class="section padded-top">
    <div class="section-heading">
      <p class="eyebrow">Blog</p>
      <h1>Notes from the map.</h1>
      <p>Product updates, architecture notes, and field reports from the Scope build.</p>
    </div>
    <div class="feature-grid">
      <RouterLink v-for="post in posts" :key="post.slug" class="card blog-card" :to="`/blog/${post.slug}`">
        <span>{{ post.readTime }}</span>
        <h2>{{ post.title }}</h2>
        <p>{{ post.excerpt }}</p>
      </RouterLink>
    </div>
  </main>
</template>
