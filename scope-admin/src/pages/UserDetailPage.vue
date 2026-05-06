<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getUser } from '@/api/core';
import type { UserProfile } from '@/types/user';

const route = useRoute();
const user = ref<UserProfile | null>(null);

onMounted(async () => {
  try {
    user.value = await getUser(String(route.params.id));
  } catch {
    user.value = {
      id: String(route.params.id),
      username: 'Selected user',
      email: 'unknown@scope.local',
      role: 'user',
      status: 'active',
    };
  }
});
</script>

<template>
  <section class="glass-panel admin-card">
    <p class="eyebrow">User detail</p>
    <h2>{{ user?.username ?? 'Loading user' }}</h2>
    <p>{{ user?.email }}</p>
    <div class="detail-actions">
      <button class="btn primary" type="button">Edit role</button>
      <button class="btn secondary" type="button">Reset session</button>
      <button class="btn danger" type="button">Disable account</button>
    </div>
  </section>
</template>
