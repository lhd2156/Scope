<script setup lang="ts">
import { assetPath } from "@/data";

const webAppUrl = import.meta.env.VITE_SCOPE_WEB_APP_URL || "https://scope.example.com";
</script>

<template>
  <main class="download-page">
    <p class="eyebrow">
      Open Scope
    </p>
    <h1>Open Scope wherever you plan.</h1>
    <p>Scope is now focused on the responsive web app for planning, mapping, and social discovery.</p>
    <a
      class="button primary"
      :href="webAppUrl"
    >Launch Web App</a>
    <div class="qr-card">
      <img
        :src="assetPath('/qr-web.svg')"
        alt="Scope web app QR code"
      >
      <h2>Web App</h2>
    </div>
  </main>
</template>
