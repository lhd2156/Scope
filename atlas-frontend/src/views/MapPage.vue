<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Map"
        title="Atlas map workspace"
        description="A map-ready layout with viewport controls and route-aware spot cards."
      />

      <section class="map-layout">
        <article class="glass-panel map-surface">
          <div class="map-headline">
            <div>
              <strong>Viewport</strong>
              <p>{{ mapStore.viewport.center[0].toFixed(2) }}, {{ mapStore.viewport.center[1].toFixed(2) }} · zoom {{ mapStore.viewport.zoom }}</p>
            </div>
            <div class="map-actions">
              <button class="button button-secondary" type="button" @click="mapStore.setZoom(mapStore.viewport.zoom - 1)">-</button>
              <button class="button button-secondary" type="button" @click="mapStore.setZoom(mapStore.viewport.zoom + 1)">+</button>
            </div>
          </div>
          <div class="map-box">
            <p>Mapbox layer placeholder using <code>{{ mapStore.viewport.style }}</code></p>
            <p>Connect <code>VITE_MAPBOX_TOKEN</code> to swap this shell for live map rendering.</p>
          </div>
        </article>

        <aside class="glass-panel spot-sidebar">
          <h2>Visible spots</h2>
          <div class="sidebar-list">
            <SpotCard v-for="spot in spotsStore.items.slice(0, 3)" :key="spot.id" :spot="spot" />
          </div>
        </aside>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import SpotCard from '@/components/spots/SpotCard.vue';
import { useMapStore } from '@/stores/map';
import { useSpotsStore } from '@/stores/spots';

const mapStore = useMapStore();
const spotsStore = useSpotsStore();

onMounted(async () => {
  await spotsStore.fetchSpots();
});
</script>

<style scoped>
.map-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(20rem, 0.8fr);
  gap: var(--space-6);
}

.map-surface,
.spot-sidebar {
  padding: var(--space-6);
}

.map-headline,
.map-actions {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: center;
}

.map-headline p,
.map-box p {
  color: var(--text-secondary);
}

.map-box {
  min-height: 28rem;
  margin-top: var(--space-5);
  border: 1px dashed var(--border-hover);
  border-radius: var(--radius-xl);
  display: grid;
  place-items: center;
  text-align: center;
  padding: var(--space-6);
  background:
    radial-gradient(circle at top, var(--accent-teal-light), transparent 45%),
    var(--bg-secondary);
}

.sidebar-list {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-4);
}

@media (max-width: 1100px) {
  .map-layout {
    grid-template-columns: 1fr;
  }
}
</style>
