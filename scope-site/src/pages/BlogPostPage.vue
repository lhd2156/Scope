<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { findPostBySlug } from "@/data";

const route = useRoute();
const post = computed(() => findPostBySlug(route.params.slug));
</script>

<template>
  <main class="article-page">
    <RouterLink
      class="back-link"
      to="/blog"
    >
      Back to blog
    </RouterLink>
    <article
      v-if="post"
      class="card article-card"
    >
      <p class="eyebrow">
        {{ post.date }} - {{ post.readTime }}
      </p>
      <h1>{{ post.title }}</h1>
      <p class="lead">
        {{ post.excerpt }}
      </p>
      <p>{{ post.body }}</p>
      <div class="badge-row">
        <span
          v-for="tag in post.tags"
          :key="tag"
        >{{ tag }}</span>
      </div>
    </article>
    <article
      v-else
      class="card article-card"
    >
      <p class="eyebrow">
        Not found
      </p>
      <h1>This post does not exist.</h1>
      <p>The article you are looking for may have moved or never existed. Head back to the blog to browse everything we have published.</p>
    </article>
  </main>
</template>
