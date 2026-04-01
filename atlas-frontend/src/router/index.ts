import { createRouter, createWebHistory } from 'vue-router';
import { resolveNavigationGuard } from '@/router/guards';
import { lazyView } from '@/router/lazyView';
import {
  attachAnalyticsPageEngagementTracker,
  beginRoutePageEngagement,
  trackRoutePageView,
} from '@/services/analyticsService';

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

const INDEXABLE_ROBOTS = 'index,follow';
const PRIVATE_ROBOTS = 'noindex,nofollow';

function publicRouteMeta(title: string, description: string) {
  return {
    title,
    description,
    robots: INDEXABLE_ROBOTS,
  };
}

function privateRouteMeta(title: string, description: string) {
  return {
    requiresAuth: true,
    title,
    description,
    robots: PRIVATE_ROBOTS,
  };
}

function guestRouteMeta(title: string, description: string) {
  return {
    guestOnly: true,
    title,
    description,
    robots: PRIVATE_ROBOTS,
  };
}

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
    meta: publicRouteMeta(
      'Atlas — Discover spots, map stories, and plan smarter trips',
      'Discover community-loved spots, turn real-world outings into shareable stories, and build smarter itineraries with Atlas.',
    ),
  },
  {
    path: '/explore',
    name: 'explore',
    component: ExplorePage,
    meta: publicRouteMeta(
      'Explore community-loved spots | Atlas',
      'Browse Atlas spots by category, city, and vibe to find your next food stop, scenic trail, cultural gem, or nightlife plan.',
    ),
  },
  {
    path: '/map',
    name: 'map',
    component: MapPage,
    meta: publicRouteMeta(
      'Live adventure map | Atlas',
      'Open the full Atlas map to explore pins, compare neighborhoods, and jump straight into the places shaping your next outing.',
    ),
  },
  {
    path: '/trips/new',
    name: 'trip-planner',
    component: TripPlannerPage,
    meta: privateRouteMeta(
      'AI trip planner | Atlas',
      'Build a smarter Atlas itinerary with destination, timing, pace, and group preferences tailored to your next adventure.',
    ),
  },
  {
    path: '/trips/:id',
    name: 'trip-detail',
    component: TripDetailPage,
    meta: privateRouteMeta(
      'Trip workspace | Atlas',
      'Review itinerary timing, collaborators, and pinned stops inside your Atlas trip workspace.',
    ),
  },
  {
    path: '/spots/new',
    name: 'spot-create',
    component: SpotComposerPage,
    meta: privateRouteMeta(
      'Create a spot | Atlas',
      'Publish a new Atlas pin with photos, notes, coordinates, and category details so your community can discover it.',
    ),
  },
  {
    path: '/spots/:id/edit',
    name: 'spot-edit',
    component: SpotComposerPage,
    meta: privateRouteMeta(
      'Edit your spot | Atlas',
      'Refresh an existing Atlas spot with better copy, updated coordinates, stronger photos, or new review context.',
    ),
  },
  {
    path: '/spots/:id',
    name: 'spot-detail',
    component: SpotDetailPage,
    meta: publicRouteMeta(
      'Spot details | Atlas',
      'See Atlas spot photos, reviews, map context, and location details before deciding where to head next.',
    ),
  },
  {
    path: '/profile/:id',
    name: 'profile',
    component: ProfilePage,
    meta: privateRouteMeta(
      'Explorer profile | Atlas',
      'Review an Atlas explorer’s mapped highlights, public pins, and collaborative trip footprint in one workspace.',
    ),
  },
  {
    path: '/friends',
    name: 'friends',
    component: FriendsPage,
    meta: privateRouteMeta(
      'Friend graph | Atlas',
      'Manage your Atlas network, incoming requests, and shared-adventure relationships in one place.',
    ),
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
    meta: privateRouteMeta(
      'Account settings | Atlas',
      'Update your Atlas profile, preferences, and account details while keeping your adventure workspace personalized.',
    ),
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: guestRouteMeta(
      'Log in to Atlas',
      'Sign in to Atlas to pick up your saved trips, network activity, and pinned adventure stories.',
    ),
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterPage,
    meta: guestRouteMeta(
      'Create your Atlas account',
      'Join Atlas to map real-world experiences, share stories with friends, and unlock smarter itinerary planning.',
    ),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage,
    meta: {
      title: 'Page not found | Atlas',
      description: 'The requested Atlas route could not be found. Jump back into home, explore, or the live map to continue discovering.',
      robots: PRIVATE_ROBOTS,
      canonicalPath: false,
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

attachAnalyticsPageEngagementTracker();

router.beforeEach((to) => resolveNavigationGuard(to));
router.afterEach((to, _from, failure) => {
  if (failure) {
    return;
  }

  trackRoutePageView(to);
  beginRoutePageEngagement(to);
});

export default router;
