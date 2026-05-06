import type { RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

export async function resolveNavigationGuard(to: RouteLocationNormalized) {
  const authStore = useAuthStore();
  const requiresSessionCheck = Boolean(to.meta.requiresAuth || to.meta.guestOnly);

  if (requiresSessionCheck && !authStore.hasHydratedSession) {
    await authStore.hydrateSession();
  }

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
