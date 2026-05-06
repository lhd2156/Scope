import { createRouter, createWebHistory } from 'vue-router';
import { resolveNavigationGuard } from '@/router/guards';
import { lazyView } from '@/router/lazyView';
import {
  attachAnalyticsPageEngagementTracker,
  beginRoutePageEngagement,
  trackRoutePageView,
} from '@/services/analyticsService';
import { isScopeQaMode } from '@/utils/qaMode';
import { scheduleNonCriticalTask } from '@/utils/scheduleNonCriticalTask';

const HomePage = lazyView(() => import('@/views/HomePage.vue'));
const ExplorePage = lazyView(() => import('@/views/ExplorePage.vue'));
const MapPage = lazyView(() => import('@/views/MapPage.vue'));
const TripsWorkspacePage = lazyView(() => import('@/views/TripsWorkspacePage.vue'));
const TripPlannerPage = lazyView(() => import('@/views/TripPlannerPage.vue'));
const ScopeAIPage = lazyView(() => import('@/views/ScopeAIPage.vue'));
const TripDetailPage = lazyView(() => import('@/views/TripDetailPage.vue'));
const SpotComposerPage = lazyView(() => import('@/views/SpotComposerPage.vue'));
const SpotDetailPage = lazyView(() => import('@/views/SpotDetailPage.vue'));
const ProfilePage = lazyView(() => import('@/views/ProfilePage.vue'));
const FriendsPage = lazyView(() => import('@/views/FriendsPage.vue'));
const SettingsPage = lazyView(() => import('@/views/SettingsPage.vue'));
const LoginPage = lazyView(() => import('@/views/LoginPage.vue'));
const RegisterPage = lazyView(() => import('@/views/RegisterPage.vue'));
const OnboardingPreferencesPage = lazyView(() => import('@/views/OnboardingPreferencesPage.vue'));
const LegalPage = lazyView(() => import('@/views/LegalPage.vue'));
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
    robots: INDEXABLE_ROBOTS,
  };
}

function guestRouteMeta(title: string, description: string) {
  return {
    guestOnly: true,
    title,
    description,
    robots: INDEXABLE_ROBOTS,
  };
}

function scheduleAnalyticsTask(task: () => void | Promise<void>): void {
  if (isScopeQaMode()) {
    return;
  }

  scheduleNonCriticalTask(task, {
    delayMs: 1_200,
    timeoutMs: 3_000,
  });
}

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
    meta: publicRouteMeta(
      'Scope — Discover spots, map stories, and plan smarter trips',
      'Discover community-loved spots, turn real-world outings into shareable stories, and build smarter itineraries with Scope.',
    ),
  },
  {
    path: '/explore',
    name: 'explore',
    component: ExplorePage,
    meta: publicRouteMeta(
      'Explore community-loved spots | Scope',
      'Browse Scope spots by category, city, and vibe to find your next food stop, scenic trail, cultural gem, or nightlife plan.',
    ),
  },
  {
    path: '/map',
    name: 'map',
    component: MapPage,
    meta: publicRouteMeta(
      'Live adventure map | Scope',
      'Open the full Scope map to explore pins, compare neighborhoods, and jump straight into the places shaping your next outing.',
    ),
  },
  {
    path: '/trips',
    name: 'trips',
    component: TripsWorkspacePage,
    meta: privateRouteMeta(
      'Trips workspace | Scope',
      'Open saved drafts, shared trip documents, and published Scope routes in one trip workspace.',
    ),
  },
  {
    path: '/trips/new',
    name: 'trip-planner',
    component: TripPlannerPage,
    meta: privateRouteMeta(
      'AI trip planner | Scope',
      'Build a smarter Scope itinerary with destination, timing, pace, and group preferences tailored to your next adventure.',
    ),
  },
  {
    path: '/trips/:id/edit',
    name: 'trip-edit',
    component: TripPlannerPage,
    meta: privateRouteMeta(
      'Edit trip draft | Scope',
      'Edit a saved Scope trip draft, update the crew, and refresh the AI itinerary before publishing.',
    ),
  },
  {
    path: '/ai/trip-planner',
    redirect: { name: 'trip-planner', query: { assistant: 'open' } },
  },
  {
    path: '/ai/ask',
    name: 'scope-ai',
    component: ScopeAIPage,
    meta: privateRouteMeta(
      'Scope AI assistant | Scope',
      'Ask Scope AI anything about travel spots, reviews, and recommendations powered by RAG and local LLMs.',
    ),
  },
  {
    path: '/trips/:id',
    name: 'trip-detail',
    component: TripDetailPage,
    meta: privateRouteMeta(
      'Trip workspace | Scope',
      'Review itinerary timing, collaborators, and pinned stops inside your Scope trip workspace.',
    ),
  },
  {
    path: '/spots/new',
    name: 'spot-create',
    component: SpotComposerPage,
    meta: privateRouteMeta(
      'Create a spot | Scope',
      'Publish a new Scope pin with photos, notes, coordinates, and category details so your community can discover it.',
    ),
  },
  {
    path: '/spots/:id/edit',
    name: 'spot-edit',
    component: SpotComposerPage,
    meta: privateRouteMeta(
      'Edit your spot | Scope',
      'Refresh an existing Scope spot with better copy, updated coordinates, stronger photos, or new review context.',
    ),
  },
  {
    path: '/spots/:id',
    name: 'spot-detail',
    component: SpotDetailPage,
    meta: publicRouteMeta(
      'Spot details | Scope',
      'See Scope spot photos, reviews, map context, and location details before deciding where to head next.',
    ),
  },
  {
    path: '/profile/:id',
    name: 'profile',
    component: ProfilePage,
    meta: privateRouteMeta(
      'Explorer profile | Scope',
      'Review an Scope explorer’s mapped highlights, public pins, and collaborative trip footprint in one workspace.',
    ),
  },
  {
    path: '/friends',
    name: 'friends',
    component: FriendsPage,
    meta: privateRouteMeta(
      'Friend graph | Scope',
      'Manage your Scope network, incoming requests, and shared-adventure relationships in one place.',
    ),
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
    meta: privateRouteMeta(
      'Account settings | Scope',
      'Update your Scope profile, preferences, and account details while keeping your adventure workspace personalized.',
    ),
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: guestRouteMeta(
      'Log in to Scope',
      'Sign in to Scope to pick up your saved trips, network activity, and pinned adventure stories.',
    ),
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterPage,
    meta: guestRouteMeta(
      'Create your Scope account',
      'Join Scope to map real-world experiences, share stories with friends, and unlock smarter itinerary planning.',
    ),
  },
  {
    path: '/onboarding/preferences',
    name: 'onboarding-preferences',
    component: OnboardingPreferencesPage,
    meta: privateRouteMeta(
      'Personalize Scope | Onboarding',
      'Tell Scope what matters most on your next adventure so every map, feed, and trip suggestion leans your way.',
    ),
  },
  {
    path: '/privacy',
    alias: '/privacy-policy',
    name: 'privacy',
    component: LegalPage,
    meta: publicRouteMeta(
      'Privacy Policy | Scope',
      'Read the simple Scope privacy overview for account, map, planning, and analytics data.',
    ),
  },
  {
    path: '/terms',
    alias: '/terms-of-service',
    name: 'terms',
    component: LegalPage,
    meta: publicRouteMeta(
      'Terms of Service | Scope',
      'Review the simple Scope terms for accounts, shared content, and responsible use.',
    ),
  },
  {
    path: '/cookies',
    name: 'cookies',
    component: LegalPage,
    meta: publicRouteMeta(
      'Cookie Choices | Scope',
      'Review how Scope uses essential storage and optional analytics cookies.',
    ),
  },
  {
    path: '/accessibility',
    name: 'accessibility',
    component: LegalPage,
    meta: publicRouteMeta(
      'Accessibility | Scope',
      'Read the Scope accessibility notes for keyboard, contrast, and responsive support.',
    ),
  },
  {
    path: '/security',
    name: 'security',
    component: LegalPage,
    meta: publicRouteMeta(
      'Security | Scope',
      'Read the Scope security overview for account protection, APIs, and deployment defaults.',
    ),
  },
  {
    path: '/about',
    name: 'about',
    component: LegalPage,
    meta: publicRouteMeta(
      'About Scope',
      'Learn what Scope is building for real-world adventure discovery and planning.',
    ),
  },
  {
    path: '/help',
    name: 'help',
    component: LegalPage,
    meta: publicRouteMeta(
      'Help | Scope',
      'Find simple help for exploring places, planning trips, and contacting Scope support.',
    ),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage,
    meta: {
      title: 'Page not found | Scope',
      description: 'The requested Scope route could not be found. Jump back into home, explore, or the live map to continue discovering.',
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

scheduleAnalyticsTask(() => {
  attachAnalyticsPageEngagementTracker();
});

router.beforeEach((to) => resolveNavigationGuard(to));
router.afterEach((to, _from, failure) => {
  if (failure) {
    return;
  }

  scheduleAnalyticsTask(() => {
    trackRoutePageView(to);
    beginRoutePageEngagement(to);
  });
});

export default router;
