import { createRouter, createWebHistory } from 'vue-router';
import { resolveNavigationGuard } from '@/router/guards';
import { lazyView } from '@/router/lazyView';

const HomePage = lazyView(() => import('@/views/HomePage.vue'));
const ExplorePage = lazyView(() => import('@/views/ExplorePage.vue'));
const MapPage = lazyView(() => import('@/views/MapPage.vue'));
const TripPlannerPage = lazyView(() => import('@/views/TripPlannerPage.vue'));
const TripDetailPage = lazyView(() => import('@/views/TripDetailPage.vue'));
const SpotComposerPage = lazyView(() => import('@/views/SpotComposerPage.vue'));
const SpotDetailPage = lazyView(() => import('@/views/SpotDetailPage.vue'));
const ProfilePage = lazyView(() => import('@/views/ProfilePage.vue'));
const FriendsPage = lazyView(() => import('@/views/FriendsPage.vue'));
const SettingsPage = lazyView(() => import('@/views/SettingsPage.vue'));
const LoginPage = lazyView(() => import('@/views/LoginPage.vue'));
const RegisterPage = lazyView(() => import('@/views/RegisterPage.vue'));
const NotFoundPage = lazyView(() => import('@/views/NotFoundPage.vue'));

const routes = [
  { path: '/', name: 'home', component: HomePage },
  { path: '/explore', name: 'explore', component: ExplorePage },
  { path: '/map', name: 'map', component: MapPage },
  { path: '/trips/new', name: 'trip-planner', component: TripPlannerPage, meta: { requiresAuth: true } },
  { path: '/trips/:id', name: 'trip-detail', component: TripDetailPage, meta: { requiresAuth: true } },
  { path: '/spots/new', name: 'spot-create', component: SpotComposerPage, meta: { requiresAuth: true } },
  { path: '/spots/:id/edit', name: 'spot-edit', component: SpotComposerPage, meta: { requiresAuth: true } },
  { path: '/spots/:id', name: 'spot-detail', component: SpotDetailPage },
  { path: '/profile/:id', name: 'profile', component: ProfilePage, meta: { requiresAuth: true } },
  { path: '/friends', name: 'friends', component: FriendsPage, meta: { requiresAuth: true } },
  { path: '/settings', name: 'settings', component: SettingsPage, meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: LoginPage, meta: { guestOnly: true } },
  { path: '/register', name: 'register', component: RegisterPage, meta: { guestOnly: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => resolveNavigationGuard(to));

export default router;
