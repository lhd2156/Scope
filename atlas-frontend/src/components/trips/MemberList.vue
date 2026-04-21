<template>
  <section class="member-list" data-test="member-list">
    <header class="list-header">
      <div>
        <p class="eyebrow">Trip members</p>
        <h2>{{ title }}</h2>
      </div>
      <span class="meta-pill">{{ members.length }} total</span>
    </header>

    <div class="member-grid">
      <article v-for="member in members" :key="member.id" class="surface-card member-card">
        <Avatar :name="member.displayName" :src="member.avatarUrl" :size="48" class="member-avatar" />

        <div class="member-copy">
          <strong>{{ member.displayName }}</strong>
          <span>{{ roleLabel(member.status) }}</span>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import Avatar from '@/components/common/Avatar.vue';
import type { TripMember } from '@/types';

withDefaults(
  defineProps<{
    members: TripMember[];
    title?: string;
  }>(),
  {
    title: 'Crew on this route',
  },
);

function roleLabel(status?: string): string {
  if (!status) {
    return 'Trip member';
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}
</script>

<style scoped>
.member-list,
.member-grid,
.member-card,
.member-copy {
  display: grid;
  gap: var(--space-4);
}

.list-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.list-header h2,
.member-copy strong,
.member-copy span {
  margin: 0;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  font-size: var(--font-size-small);
}

.member-grid {
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}

.member-card {
  grid-template-columns: auto 1fr;
  align-items: center;
  padding: var(--space-4);
}

.member-avatar {
  border-radius: var(--radius-full);
}

.member-copy strong {
  color: var(--text-primary);
}

.member-copy span {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

@media (max-width: 720px) {
  .list-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
