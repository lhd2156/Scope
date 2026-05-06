<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { listPhotos, moderatePhoto } from '@/api/content';
import type { AdminPhoto } from '@/types/spot';

const photos = ref<AdminPhoto[]>([]);
const selected = ref<Set<string>>(new Set());

async function loadPhotos() {
  const result = await listPhotos({ page: 1, pageSize: 25, status: 'pending' });
  photos.value = result.items;
}

async function approveSelected() {
  await Promise.all([...selected.value].map((id) => moderatePhoto(id, 'approved')));
  selected.value = new Set();
  await loadPhotos();
}

function toggle(id: string) {
  const next = new Set(selected.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selected.value = next;
}

onMounted(loadPhotos);
</script>

<template>
  <section class="glass-panel admin-card">
    <div class="card-header">
      <div>
        <h2>Photos</h2>
        <p>Bulk moderate pending uploads.</p>
      </div>
      <button class="btn primary" type="button" @click="approveSelected">Approve selected</button>
    </div>
    <div class="photo-grid">
      <label v-for="photo in photos" :key="photo.id" class="photo-card">
        <input type="checkbox" :checked="selected.has(photo.id)" @change="toggle(photo.id)" />
        <img :src="photo.url" alt="Pending uploaded spot" />
        <span>{{ photo.status ?? 'pending' }}</span>
      </label>
    </div>
  </section>
</template>
