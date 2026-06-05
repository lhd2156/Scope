<script setup lang="ts">
import { assetPath } from "@/data";

const webAppUrl = import.meta.env.VITE_SCOPE_WEB_APP_URL || "https://scopetrips.com";
</script>

<template>
  <main class="download-page">
    <p class="eyebrow">
      Open Scope Trips
    </p>
    <h1>Open Scope Trips wherever you plan.</h1>
    <p>Scope Trips is focused on the responsive web app for planning, mapping, and social discovery.</p>
    <a
      class="button primary"
      :href="webAppUrl"
    >Open App</a>
    <div class="qr-card">
      <img
        :src="assetPath('/qr-web.svg')"
        alt="Scope Trips web app QR code"
      >
      <h2>Web App</h2>
    </div>
  </main>
</template>
