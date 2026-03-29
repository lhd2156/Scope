<template>
  <section class="member-list glass-panel">
    <header class="member-list__header">
      <div>
        <p class="eyebrow">Members</p>
        <h2>{{ members.length }} traveler{{ members.length === 1 ? '' : 's' }}</h2>
      </div>
      <span class="member-list__hint">Roles update collaboration permissions.</span>
    </header>

    <div class="member-list__grid">
      <article v-for="member in members" :key="member.id" class="surface-card member-card">
        <img v-if="member.avatarUrl" :src="member.avatarUrl" :alt="member.displayName" class="member-avatar-image" />
        <span v-else class="member-avatar-fallback">{{ getInitials(member.displayName) }}</span>

        <div class="member-copy">
          <strong>{{ member.displayName }}</strong>
          <span class="member-role">{{ formatRole(member.status) }}</span>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { TripMember } from '@/types';

defineProps<{
  members: TripMember[];
}>();

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function formatRole(role?: string): string {
  if (!role) {
    return 'Member';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}
</script>

<style scoped>
.member-list {
  padding: var(--space-5);
  display: grid;
  gap: var(--space-5);
}

.member-list__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.member-list__header h2,
.member-list__hint,
.member-copy strong,
.member-copy span {
  margin: 0;
}

.member-list__hint,
.member-role {
  color: var(--text-secondary);
}

.member-list__grid {
  display: grid;
  gap: var(--space-4);
}

.member-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-4);
}

.member-avatar-image,
.member-avatar-fallback {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-full);
}

.member-avatar-image {
  object-fit: cover;
}

.member-avatar-fallback {
  display: grid;
  place-items: center;
  background: var(--accent-teal-light);
  color: var(--accent-teal);
  font-weight: var(--font-weight-bold);
}

.member-copy {
  display: grid;
  gap: var(--space-1);
}

@media (max-width: 720px) {
  .member-list__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
