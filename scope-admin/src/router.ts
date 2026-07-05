import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import AdminShell from '@/components/AdminShell.vue';
import DashboardPage from '@/pages/DashboardPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import PhotosPage from '@/pages/PhotosPage.vue';
import ReviewsPage from '@/pages/ReviewsPage.vue';
import SimplePage from '@/pages/SimplePage.vue';
import SpotsPage from '@/pages/SpotsPage.vue';
import UserDetailPage from '@/pages/UserDetailPage.vue';
import UsersPage from '@/pages/UsersPage.vue';
import { useAuthStore } from '@/stores/authStore';

const configuredBase =
  import.meta.env.VITE_ADMIN_BASENAME ?? import.meta.env.VITE_ADMIN_BASE_PATH ?? '/admin';
const basename = `/${configuredBase.replace(/^\/+|\/+$/g, '')}`;

const routes: RouteRecordRaw[] = [
  { path: '/login', component: LoginPage },
  {
    path: '/',
    component: AdminShell,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: DashboardPage, meta: { title: 'Dashboard' } },
      { path: 'users', component: UsersPage, meta: { title: 'Users' } },
      { path: 'users/:id', component: UserDetailPage, meta: { title: 'User detail' } },
      { path: 'spots', component: SpotsPage, meta: { title: 'Spots' } },
      {
        path: 'trips',
        component: SimplePage,
        props: { title: 'Trips', description: 'Trip planning and itinerary moderation.' },
        meta: { title: 'Trips' },
      },
      { path: 'reviews', component: ReviewsPage, meta: { title: 'Reviews' } },
      { path: 'photos', component: PhotosPage, meta: { title: 'Photos' } },
      {
        path: 'analytics',
        component: SimplePage,
        props: { title: 'Analytics', description: 'Operational metrics and discovery trends.' },
        meta: { title: 'Analytics' },
      },
      {
        path: 'settings',
        component: SimplePage,
        props: { title: 'Settings', description: 'Admin environment and platform controls.' },
        meta: { title: 'Settings' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
];

export const router = createRouter({
  history: createWebHistory(basename),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  auth.refreshFromStorage();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return '/login';
  }

  if (to.path === '/login' && auth.isAuthenticated) {
    return '/dashboard';
  }

  return true;
});
