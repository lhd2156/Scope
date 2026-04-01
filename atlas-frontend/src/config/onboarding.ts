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
    ctaLabel: 'See discovery tools',
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
