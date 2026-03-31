export type OnboardingRouteName = 'home' | 'explore' | 'map' | 'trip-planner';
export type OnboardingStepPlacement = 'top' | 'right' | 'bottom' | 'left' | 'center';

export interface OnboardingStep {
  id: string;
  routeName: OnboardingRouteName;
  selector: string;
  eyebrow: string;
  title: string;
  description: string;
  placement: OnboardingStepPlacement;
  ctaLabel: string;
}

const publicOnboardingSteps: readonly OnboardingStep[] = [
  {
    id: 'home-hero',
    routeName: 'home',
    selector: '[data-onboarding-target="home-hero"]',
    eyebrow: 'Atlas walkthrough',
    title: 'Start on the home launchpad',
    description: 'Atlas opens with a photo-forward landing page, quick access to trending destinations, and a premium path into the rest of the adventure workspace.',
    placement: 'bottom',
    ctaLabel: 'Show discovery',
  },
  {
    id: 'explore-toolbar',
    routeName: 'explore',
    selector: '[data-onboarding-target="explore-toolbar"]',
    eyebrow: 'Discovery controls',
    title: 'Refine the shortlist in Explore',
    description: 'Search by city, vibe, or spot name, then layer quick filters to narrow the places that deserve a closer look.',
    placement: 'bottom',
    ctaLabel: 'Open the live map',
  },
  {
    id: 'map-filters',
    routeName: 'map',
    selector: '[data-onboarding-target="map-filters"]',
    eyebrow: 'Live map workspace',
    title: 'See the route come alive on the map',
    description: 'Category toggles reshape the live pin canvas instantly, so you can compare moods, neighborhoods, and route potential without leaving the workspace.',
    placement: 'right',
    ctaLabel: 'Keep going',
  },
] as const;

const authenticatedOnboardingSteps: readonly OnboardingStep[] = [
  {
    id: 'planner-submit',
    routeName: 'trip-planner',
    selector: '[data-onboarding-target="planner-submit"]',
    eyebrow: 'Atlas Intel',
    title: 'Turn the brief into an AI itinerary',
    description: 'Once the route brief feels right, Atlas Intel can generate a polished day-by-day plan you can review, refine, and share with your crew.',
    placement: 'top',
    ctaLabel: 'Finish tour',
  },
] as const;

export function resolveOnboardingSteps(isAuthenticated: boolean): OnboardingStep[] {
  return isAuthenticated
    ? [...publicOnboardingSteps, ...authenticatedOnboardingSteps]
    : [...publicOnboardingSteps];
}
