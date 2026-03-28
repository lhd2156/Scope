<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Trip detail"
        title="Collaborative itinerary view"
        description="Trip members, destination framing, and itinerary output rendered from the trip store."
      />

      <section v-if="tripsStore.selectedTrip" class="page-stack">
        <article class="glass-panel trip-hero">
          <div>
            <p class="eyebrow">{{ tripsStore.selectedTrip.destination }}</p>
            <h1>{{ tripsStore.selectedTrip.title }}</h1>
            <p class="section-copy">{{ tripsStore.selectedTrip.description }}</p>
          </div>
          <div class="trip-summary">
            <span>{{ tripsStore.selectedTrip.startDate }} → {{ tripsStore.selectedTrip.endDate }}</span>
            <span>{{ tripsStore.selectedTrip.members.length }} members</span>
            <span>{{ tripsStore.selectedTrip.spots.length }} stops</span>
          </div>
        </article>

        <section class="glass-panel members-panel">
          <h2>Members</h2>
          <div class="members-grid">
            <article v-for="member in tripsStore.selectedTrip.members" :key="member.id" class="member-chip">
              <strong>{{ member.displayName }}</strong>
              <span>{{ member.status }}</span>
            </article>
          </div>
        </section>

        <ItineraryView :itinerary="tripsStore.selectedTrip.itinerary ?? null" />
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import ItineraryView from '@/components/trips/ItineraryView.vue';
import { useTripsStore } from '@/stores/trips';

const route = useRoute();
const tripsStore = useTripsStore();

onMounted(async () => {
  await tripsStore.fetchTrip(String(route.params.id));
});
</script>

<style scoped>
.trip-hero,
.members-panel {
  padding: var(--space-6);
}

.trip-hero {
  display: flex;
  justify-content: space-between;
  gap: var(--space-6);
}

.trip-hero h1,
.members-panel h2 {
  margin: 0;
}

.trip-summary {
  display: grid;
  gap: var(--space-2);
  color: var(--text-secondary);
  text-align: right;
}

.members-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.member-chip {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--bg-secondary);
}

.member-chip span,
.eyebrow {
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .trip-hero {
    flex-direction: column;
  }

  .trip-summary {
    text-align: left;
  }

  .members-grid {
    grid-template-columns: 1fr;
  }
}
</style>
