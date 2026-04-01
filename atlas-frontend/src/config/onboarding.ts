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
    eyebrow: 'Welcome to Atlas',
    title: 'Map every adventure before you ever leave home',
    description: 'Atlas brings pin drops, live map discovery, AI trip planning, and traveler momentum into one premium workspace built for real-world adventures.',
    placement: 'center',
    ctaLabel: 'Start the tour',
    variant: 'welcome',
    showSpotlight: false,
    highlights: [
      {
        icon: 'pin',
        title: 'Drop memorable pins',
        description: 'Capture the places worth revisiting with photos, stories, and vibe-rich detail.',
      },
      {
        icon: 'map',
        title: 'Explore the live map',
        description: 'Filter neighborhoods, categories, and routes without leaving the canvas.',
      },
      {
        icon: 'route',
        title: 'Plan with Atlas Intel',
        description: 'Turn a shortlist into a polished day-by-day itinerary in seconds.',
      },
      {
        icon: 'friends',
        title: 'Travel with your crew',
        description: 'Share adventures, follow trusted travelers, and keep the journey social.',
      },
    ],
  },
  {
    id: 'create-spot-button',
    routeName: 'home',
    selector: '[data-onboarding-target="create-spot-button"]',
    eyebrow: 'Drop your first pin',
    title: 'Capture the places worth sharing',
    description: 'Use Create Spot whenever you find a rooftop, trail, or hidden cafe worth saving. Atlas turns one tap into a photo-rich pin your crew can revisit later.',
    placement: 'bottom',
    ctaLabel: 'Open the live map',
    highlights: [
      {
        icon: 'camera',
        title: 'Add visual proof',
        description: 'Lead with the view, menu, trailhead, or detail shot that makes the place memorable.',
      },
      {
        icon: 'pin',
        title: 'Lock in the context',
        description: 'Save the category, location, and quick notes so every future route starts from better signal.',
      },
    ],
  },
  {
    id: 'map-filters',
    routeName: 'map',
    selector: '[data-onboarding-target="map-filters"]',
    eyebrow: 'Explore the map',
    title: 'Guide the canvas with controls and category lanes',
    description: 'Use the floating controls to zoom, recenter, or fit the route, then tap category filters to instantly reshape which pins Atlas keeps in play.',
    placement: 'right',
    ctaLabel: 'Plan a trip',
    highlights: [
      {
        icon: 'crosshair',
        title: 'Move the map fast',
        description: 'The floating stack keeps zoom, locate, and route-fit actions within reach without covering the canvas.',
      },
      {
        icon: 'map',
        title: 'Filter by mood',
        description: 'Blend food, culture, adventure, and nightlife lanes to compare the strongest clusters before you open a spot.',
      },
    ],
    accentSelectors: ['[data-onboarding-target="map-controls"]'],
  },
] as const;

const authenticatedOnboardingSteps: readonly OnboardingStep[] = [
  {
    id: 'planner-submit',
    routeName: 'trip-planner',
    selector: '[data-onboarding-target="planner-shell"]',
    eyebrow: 'Plan a trip',
    title: 'Shape the route, then let Atlas Intel compose the days',
    description: 'Build the brief, route order, pace, and interests inside the planner. Atlas Intel keeps the AI preview beside you so every tweak instantly sharpens the trip before you share it.',
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
        description: 'Atlas Intel turns the brief into a map-backed timeline with day cards, budget context, and share-ready momentum.',
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
    description: 'Open the Friends hub to accept requests, keep trusted explorers close, and turn shared taste into real trip momentum. Atlas keeps the live feed right beside that network so fresh pins, finished routes, and reviews never fall out of view.',
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
