import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useAuthStore } from '@/stores/auth';

export const useUserStore = defineStore('user', () => {
  const authStore = useAuthStore();
  const profile = computed(() => authStore.currentUser);
  const stats = computed(() => authStore.currentUser?.stats);

  return { profile, stats };
});
