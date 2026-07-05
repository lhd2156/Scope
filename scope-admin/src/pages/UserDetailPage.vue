<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getUser, updateUserStatus } from '@/api/core';
import type { UserProfile } from '@/types/user';

const route = useRoute();
const user = ref<UserProfile | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function loadUser() {
  loading.value = true;
  error.value = null;
  try {
    user.value = await getUser(String(route.params.id));
  } catch {
    error.value = 'Could not load this user. They may have been deleted, or the API is unavailable.';
  } finally {
    loading.value = false;
  }
}

async function toggleStatus() {
  if (!user.value) {
    return;
  }
  const next = user.value.status === 'banned' ? 'active' : 'banned';
  user.value = await updateUserStatus(user.value.id, next);
}

onMounted(loadUser);
</script>

<template>
  <section class="glass-panel admin-card">
    <p class="eyebrow">User detail</p>
    <template v-if="user">
      <h2>{{ user.username }}</h2>
      <p>{{ user.email }}</p>
      <p>Status: {{ user.status ?? 'active' }} - Role: {{ user.role ?? 'user' }}</p>
      <div class="detail-actions">
        <button class="btn danger" type="button" @click="toggleStatus">
          {{ user.status === 'banned' ? 'Reactivate account' : 'Ban account' }}
        </button>
      </div>
    </template>
    <template v-else-if="loading">
      <h2>Loading user</h2>
      <p>Fetching account details...</p>
    </template>
    <template v-else>
      <h2>User unavailable</h2>
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
      <div class="detail-actions">
        <button class="btn secondary" type="button" @click="loadUser">Retry</button>
      </div>
    </template>
  </section>
</template>
