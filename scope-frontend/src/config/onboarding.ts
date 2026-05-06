export type OnboardingRouteName = 'home' | 'explore' | 'map' | 'trip-planner';
export type OnboardingStepPlacement = 'top' | 'right' | 'bottom' | 'left' | 'center';
export type OnboardingStepVariant = 'default' | 'welcome';

export interface OnboardingFeatureHighlight {
  icon: string;
  title: string;
  description: string;
}

export interface OnboardingStep {
  id: string;
  routeName: OnboardingRouteName;
  selector: string;
  eyebrow: string;
  title: string;
  description: string;
  placement: OnboardingStepPlacement;
  ctaLabel: string;
  variant?: OnboardingStepVariant;
  showSpotlight?: boolean;
  highlights?: readonly OnboardingFeatureHighlight[];
  accentSelectors?: readonly string[];
}

const publicOnboardingSteps: readonly OnboardingStep[] = [
  {
    id: 'home-hero',
    routeName: 'home',
    selector: '[data-onboarding-target="home-hero"]',
    eyebrow: 'Welcome to Scope',
    title: 'Plan the day before you go',
    description: 'Drop pins, scan the live map, and turn saved places into a clean route.',
    placement: 'center',
    ctaLabel: 'Start the tour',
    variant: 'welcome',
    showSpotlight: false,
    highlights: [
      {
        icon: 'pin',
        title: 'Save real places',
        description: 'Photos, notes, and context in one pin.',
      },
      {
        icon: 'map',
        title: 'Use the map',
        description: 'Browse nearby spots by category.',
      },
      {
        icon: 'route',
        title: 'Build routes',
        description: 'Turn ideas into a day plan.',
      },
      {
        icon: 'friends',
        title: 'Share taste',
        description: 'Keep trusted recs close.',
      },
    ],
  },
  {
    id: 'create-spot-button',
    routeName: 'home',
    selector: '[data-onboarding-target="create-spot-button"]',
    eyebrow: 'Drop your first pin',
    title: 'Save places fast',
    description: 'Use Create Spot when a rooftop, trail, cafe, or overlook is worth keeping.',
    placement: 'center',
    ctaLabel: 'Open the live map',
    showSpotlight: false,
    highlights: [
      {
        icon: 'camera',
        title: 'Add a photo',
        description: 'Lead with what made it worth saving.',
      },
      {
        icon: 'pin',
        title: 'Add context',
        description: 'Category, location, and a quick note.',
      },
    ],
    accentSelectors: ['[data-onboarding-target="create-spot-button"]'],
  },
  {
    id: 'map-filters',
    routeName: 'map',
    selector: '[data-onboarding-target="map-stage"]',
    eyebrow: 'Explore the map',
    title: 'Filter the live map',
    description: 'Pick categories, zoom, locate yourself, or fit the route without leaving the map.',
    placement: 'left',
    ctaLabel: 'Plan a trip',
    highlights: [
      {
        icon: 'crosshair',
        title: 'Move fast',
        description: 'Zoom, locate, and fit routes.',
      },
      {
        icon: 'map',
        title: 'Filter lanes',
        description: 'Mix food, culture, adventure, and more.',
      },
    ],
    accentSelectors: ['[data-onboarding-target="map-filters"]', '[data-onboarding-target="map-controls"]'],
  },
] as const;

const authenticatedOnboardingSteps: readonly OnboardingStep[] = [
  {
    id: 'planner-submit',
    routeName: 'trip-planner',
    selector: '[data-onboarding-target="planner-shell"]',
    eyebrow: 'Plan a trip',
    title: 'Shape the route, then let Scope Intel compose the days',
    description: 'Build the brief, route order, pace, and interests inside the planner. Scope Intel keeps the AI preview beside you so every tweak instantly sharpens the trip before you share it.',
    placement: 'right',
    ctaLabel: 'Connect with travelers',
    highlights: [
      {
        icon: 'route',
        title: 'Tune the route stack',
        description: 'Lock the dates, budget range, and stop order until the adventure arc feels right for your crew.',
      },
      {
        icon: 'sparkle',
        title: 'Generate a polished preview',
        description: 'Scope Intel turns the brief into a map-backed timeline with day cards, budget context, and share-ready momentum.',
      },
    ],
    accentSelectors: [
      '[data-onboarding-target="planner-submit"]',
      '[data-onboarding-target="itinerary-stage"]',
      '[data-onboarding-target="planner-preview-toggle"]',
    ],
  },
  {
    id: 'social-hub',
    routeName: 'home',
    selector: '[data-onboarding-target="social-hub"]',
    eyebrow: 'Connect with travelers',
    title: 'Grow your circle, then let the feed surface the strongest signals',
    description: 'Open the Friends hub to accept requests, keep trusted explorers close, and turn shared taste into real trip momentum. Scope keeps the live feed right beside that network so fresh pins, finished routes, and reviews never fall out of view.',
    placement: 'bottom',
    ctaLabel: 'Finish tour',
    highlights: [
      {
        icon: 'friends',
        title: 'Keep your crew close',
        description: 'Review requests, mutuals, and trusted co-planners before the next route starts taking shape.',
      },
      {
        icon: 'sparkle',
        title: 'Read the live signal',
        description: 'The activity feed turns new pins, trip completions, and reviews into fast-moving inspiration you can open in one tap.',
      },
    ],
    accentSelectors: [
      '[data-onboarding-target="friends-hub-button"]',
      '[data-onboarding-target="activity-feed-list"]',
    ],
  },
] as const;

export function resolveOnboardingSteps(isAuthenticated: boolean): OnboardingStep[] {
  return isAuthenticated
    ? [...publicOnboardingSteps, ...authenticatedOnboardingSteps]
    : [...publicOnboardingSteps];
}
