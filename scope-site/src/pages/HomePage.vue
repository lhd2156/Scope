<script setup lang="ts">
import { assetPath, features, stats } from "@/data";
</script>

<template>
  <main>
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Map-first social discovery</p>
        <h1>Discover Real <span>Adventures</span></h1>
        <p>
          Scope helps people document, discover, and plan real-world experiences with community
          photos, trusted stories, and AI-powered itineraries.
        </p>
        <div class="hero-actions">
          <RouterLink class="button primary" to="/download">Get Started</RouterLink>
          <RouterLink class="button secondary" to="/features">Learn More</RouterLink>
        </div>
      </div>
      <div class="hero-media">
        <img :src="assetPath('/screenshots/map-view.png')" alt="Scope interactive map interface" />
        <div class="media-badges">
          <span>Golden hour</span>
          <span>4.9 rating</span>
          <span>18 min route</span>
        </div>
      </div>
    </section>

    <section class="stats">
      <article v-for="stat in stats" :key="stat.label">
        <strong>{{ stat.value }}</strong>
        <span>{{ stat.label }}</span>
      </article>
    </section>

    <section class="section">
      <div class="section-heading">
        <p class="eyebrow">Platform</p>
        <h2>Everything adventure planning needs in one place.</h2>
        <p>Scope blends social proof, location intelligence, and local AI into an app built for repeated exploration.</p>
      </div>
      <div class="feature-grid">
        <article v-for="feature in features" :key="feature.title" class="card">
          <span class="feature-dot" :class="feature.tone" />
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
        </article>
      </div>
    </section>

    <section class="cta">
      <p class="eyebrow">Start here</p>
      <h2>Start Your Adventure</h2>
      <p>Save real places, share the story, and let Scope turn the next open weekend into a plan.</p>
      <RouterLink class="button primary" to="/download">Open Scope</RouterLink>
    </section>
  </main>
</template>
