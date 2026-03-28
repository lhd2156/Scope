<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Trip planner"
        title="Generate an itinerary from your travel constraints"
        description="This page connects the frontend shell to the intelligence service contract with a realistic planner flow."
      />

      <section class="planner-grid">
        <form class="glass-panel planner-form" @submit.prevent="submitPlanner">
          <label>
            <span>Destination</span>
            <input v-model="form.destination" type="text" required />
          </label>
          <label>
            <span>Start date</span>
            <input v-model="form.startDate" type="date" required />
          </label>
          <label>
            <span>End date</span>
            <input v-model="form.endDate" type="date" required />
          </label>
          <label>
            <span>Budget</span>
            <input v-model.number="form.budget" type="number" min="0" required />
          </label>
          <label>
            <span>Pace</span>
            <select v-model="form.pace">
              <option value="relaxed">Relaxed</option>
              <option value="moderate">Moderate</option>
              <option value="packed">Packed</option>
            </select>
          </label>
          <label>
            <span>Group size</span>
            <input v-model.number="form.groupSize" type="number" min="1" max="12" required />
          </label>
          <fieldset>
            <legend>Interests</legend>
            <label v-for="category in categories" :key="category" class="checkbox-row">
              <input :checked="form.interests.includes(category)" type="checkbox" @change="toggleCategory(category)" />
              <span>{{ category }}</span>
            </label>
          </fieldset>
          <button class="button button-primary" type="submit">Generate itinerary</button>
        </form>

        <ItineraryView :itinerary="tripsStore.previewItinerary" />
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import ItineraryView from '@/components/trips/ItineraryView.vue';
import { useTripsStore } from '@/stores/trips';
import type { SpotCategory, TripPlannerInput } from '@/types';

const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const tripsStore = useTripsStore();

const form = reactive<TripPlannerInput>({
  destination: 'Fort Worth, TX',
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  budget: 500,
  interests: ['food', 'culture', 'nightlife'],
  pace: 'moderate',
  groupSize: 2,
});

function toggleCategory(category: SpotCategory) {
  if (form.interests.includes(category)) {
    form.interests = form.interests.filter((item) => item !== category);
    return;
  }
  form.interests = [...form.interests, category];
}

async function submitPlanner() {
  await tripsStore.buildItinerary({ ...form });
}

submitPlanner();
</script>

<style scoped>
.planner-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: var(--space-6);
}

.planner-form {
  padding: var(--space-6);
  display: grid;
  gap: var(--space-4);
}

label,
fieldset {
  display: grid;
  gap: var(--space-2);
  color: var(--text-secondary);
}

input,
select {
  width: 100%;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

fieldset {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

@media (max-width: 900px) {
  .planner-grid {
    grid-template-columns: 1fr;
  }
}
</style>
