<script setup lang="ts">
import { assetPath, features, stats } from "@/data";
</script>

<template>
  <main>
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">
          Map-first trip planning
        </p>
        <h1>Plan Real <span>Trips</span></h1>
        <p>
          Scope Trips helps people discover real spots, save the places that matter, and turn
          them into smarter routes with AI-assisted planning.
        </p>
        <div class="hero-actions">
          <RouterLink
            class="button primary"
            to="/download"
          >
            Start Planning
          </RouterLink>
          <RouterLink
            class="button secondary"
            to="/features"
          >
            Learn More
          </RouterLink>
        </div>
      </div>
      <div class="hero-media">
        <img
          :src="assetPath('/screenshots/map-view.png')"
          alt="Scope Trips interactive map interface"
        >
        <div class="media-badges">
          <span>Golden hour</span>
          <span>4.9 rating</span>
          <span>18 min route</span>
        </div>
      </div>
    </section>

    <section class="stats">
      <article
        v-for="stat in stats"
        :key="stat.label"
      >
        <strong>{{ stat.value }}</strong>
        <span>{{ stat.label }}</span>
      </article>
    </section>

    <section class="section">
      <div class="section-heading">
        <p class="eyebrow">
          Platform
        </p>
        <h2>Everything trip planning needs in one place.</h2>
        <p>Scope Trips blends social proof, location intelligence, and AI assistance into an app built for repeated exploration.</p>
      </div>
      <div class="feature-grid">
        <article
          v-for="feature in features"
          :key="feature.title"
          class="card"
        >
          <span
            class="feature-dot"
            :class="feature.tone"
          />
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
        </article>
      </div>
    </section>

    <section class="cta">
      <p class="eyebrow">
        Start here
      </p>
      <h2>Start Your Trip</h2>
      <p>Save real places, share the plan, and let Scope Trips turn the next open weekend into a route.</p>
      <RouterLink
        class="button primary"
        to="/download"
      >
        Open Scope Trips
      </RouterLink>
    </section>
  </main>
</template>
