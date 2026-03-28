<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Profile"
        title="Personal adventure map"
        description="A user summary page that blends saved spots, stats, and map positioning."
      />

      <section v-if="userStore.profile" class="profile-grid">
        <article class="glass-panel profile-card">
          <div class="avatar">{{ initials }}</div>
          <div>
            <h1>{{ userStore.profile.displayName }}</h1>
            <p class="section-copy">{{ userStore.profile.bio }}</p>
            <p class="meta">{{ userStore.profile.homeBase }}</p>
          </div>
        </article>

        <article class="glass-panel stats-card">
          <div>
            <strong>{{ userStore.stats?.spots ?? 0 }}</strong>
            <span>Spots</span>
          </div>
          <div>
            <strong>{{ userStore.stats?.trips ?? 0 }}</strong>
            <span>Trips</span>
          </div>
          <div>
            <strong>{{ userStore.stats?.friends ?? 0 }}</strong>
            <span>Friends</span>
          </div>
        </article>
      </section>

      <section>
        <SectionHeading title="Saved spots" description="Recent pins and favorites from the user profile graph." />
        <div class="card-grid">
          <SpotCard v-for="spot in spotsStore.items.slice(0, 3)" :key="spot.id" :spot="spot" />
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import SpotCard from '@/components/spots/SpotCard.vue';
import { useSpotsStore } from '@/stores/spots';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const spotsStore = useSpotsStore();

const initials = computed(() =>
  userStore.profile?.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'AT',
);

onMounted(async () => {
  await spotsStore.fetchSpots();
});
</script>

<style scoped>
.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  gap: var(--space-6);
}

.profile-card,
.stats-card {
  padding: var(--space-6);
}

.profile-card {
  display: flex;
  gap: var(--space-5);
  align-items: center;
}

.avatar {
  width: 5rem;
  height: 5rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal-light);
  color: var(--accent-teal);
  display: grid;
  place-items: center;
  font-size: var(--font-size-h2);
  font-weight: var(--font-weight-bold);
}

.stats-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  text-align: center;
}

.stats-card strong {
  display: block;
  font-size: var(--font-size-h1);
}

.meta,
.stats-card span {
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .profile-grid,
  .stats-card {
    grid-template-columns: 1fr;
  }

  .profile-card {
    flex-direction: column;
    align-items: start;
  }
}
</style>
