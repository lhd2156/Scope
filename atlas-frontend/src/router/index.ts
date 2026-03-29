import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomePage.vue') },
  { path: '/explore', name: 'explore', component: () => import('@/views/ExplorePage.vue') },
  { path: '/map', name: 'map', component: () => import('@/views/MapPage.vue') },
  { path: '/trips/new', name: 'trip-planner', component: () => import('@/views/TripPlannerPage.vue'), meta: { requiresAuth: true } },
  { path: '/trips/:id', name: 'trip-detail', component: () => import('@/views/TripDetailPage.vue'), meta: { requiresAuth: true } },
  { path: '/spots/new', name: 'spot-create', component: () => import('@/views/SpotComposerPage.vue'), meta: { requiresAuth: true } },
  { path: '/spots/:id/edit', name: 'spot-edit', component: () => import('@/views/SpotComposerPage.vue'), meta: { requiresAuth: true } },
  { path: '/spots/:id', name: 'spot-detail', component: () => import('@/views/SpotDetailPage.vue') },
  { path: '/profile/:id', name: 'profile', component: () => import('@/views/ProfilePage.vue'), meta: { requiresAuth: true } },
  { path: '/friends', name: 'friends', component: () => import('@/views/FriendsPage.vue'), meta: { requiresAuth: true } },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsPage.vue'), meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: () => import('@/views/LoginPage.vue'), meta: { guestOnly: true } },
  { path: '/register', name: 'register', component: () => import('@/views/RegisterPage.vue'), meta: { guestOnly: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundPage.vue') },
];

const router = createRouter({ history: createWebHistory(), routes, scrollBehavior: () => ({ top: 0 }) });
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' };
  }
  return true;
});

export default router;
