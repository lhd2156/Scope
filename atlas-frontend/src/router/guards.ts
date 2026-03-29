import type { RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

export function resolveNavigationGuard(to: RouteLocationNormalized) {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {
      name: 'login' as const,
      query: { redirect: to.fullPath },
    };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return {
      name: 'map' as const,
    };
  }

  return true;
}
