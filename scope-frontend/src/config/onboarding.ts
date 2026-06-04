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

export function resolveOnboardingSteps(_isAuthenticated: boolean): OnboardingStep[] {
  return [...publicOnboardingSteps];
}
