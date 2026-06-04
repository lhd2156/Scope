<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { deleteUser, listUsers, updateUserStatus } from '@/api/core';
import type { UserProfile } from '@/types/user';

const users = ref<UserProfile[]>([]);
const total = ref(0);
const page = ref(1);
const search = ref('');
const loading = ref(false);

async function loadUsers() {
  loading.value = true;
  try {
    const result = await listUsers({ page: page.value, pageSize: 25, search: search.value });
    users.value = result.items;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

async function updateStatus(user: UserProfile) {
  await updateUserStatus(user.id, user.status === 'banned' ? 'active' : 'banned');
  await loadUsers();
}

async function removeUser(user: UserProfile) {
  await deleteUser(user.id);
  await loadUsers();
}

function searchUsers() {
  page.value = 1;
  void loadUsers();
}

onMounted(loadUsers);
</script>

<template>
  <section class="glass-panel admin-card">
    <div class="card-header">
      <div>
        <h2>Users</h2>
        <p>Search accounts, audit status, and manage admin actions.</p>
      </div>
      <form class="inline-form" @submit.prevent="searchUsers">
        <input v-model="search" placeholder="Search username or email" />
        <button class="btn primary" type="submit">Search</button>
      </form>
    </div>

    <table class="admin-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Email</th>
          <th>Status</th>
          <th>Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>
            <RouterLink :to="`/users/${user.id}`">
              {{ user.username }}
            </RouterLink>
          </td>
          <td>{{ user.email }}</td>
          <td>{{ user.status ?? 'active' }}</td>
          <td>{{ user.role ?? 'user' }}</td>
          <td class="table-actions">
            <button class="btn secondary" type="button" @click="updateStatus(user)">Toggle status</button>
            <button class="btn danger" type="button" @click="removeUser(user)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>

    <footer class="table-footer">
      <span>{{ loading ? 'Loading...' : `${total} users` }}</span>
      <div class="table-actions">
        <button
          class="btn secondary"
          type="button"
          :disabled="page === 1"
          @click="
            page--;
            loadUsers();
          "
        >
          Previous
        </button>
        <button
          class="btn secondary"
          type="button"
          @click="
            page++;
            loadUsers();
          "
        >
          Next
        </button>
      </div>
    </footer>
  </section>
</template>
