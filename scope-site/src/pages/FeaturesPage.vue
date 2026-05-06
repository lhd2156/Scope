<script setup lang="ts">
import { assetPath, featureDeepDives } from "@/data";
</script>

<template>
  <main>
    <section class="page-hero">
      <p class="eyebrow">Features</p>
      <h1>Discovery, planning, and sharing for real places.</h1>
      <p>Scope combines the location intelligence of a map app with the trust and texture of social storytelling.</p>
    </section>

    <section class="deep-dives">
      <article v-for="feature in featureDeepDives" :key="feature.title" class="deep-dive">
        <div class="image-frame">
          <img :src="assetPath(feature.image)" :alt="`${feature.title} screenshot`" />
        </div>
        <div>
          <h2>{{ feature.title }}</h2>
          <p>{{ feature.description }}</p>
          <div class="badge-row">
            <span v-for="badge in feature.badges" :key="badge">{{ badge }}</span>
          </div>
        </div>
      </article>
    </section>
  </main>
</template>
