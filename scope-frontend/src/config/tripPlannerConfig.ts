import type { SpotCategory, TripPace } from '@/types';

export const TRIP_PLANNER_CATEGORIES: SpotCategory[] = [
  'food',
  'nature',
  'nightlife',
  'culture',
  'adventure',
  'shopping',
  'scenic',
  'other',
];

export const TRIP_PLANNER_CATEGORY_LABELS: Record<SpotCategory, string> = {
  food: 'Food',
  nature: 'Nature',
  nightlife: 'Nightlife',
  culture: 'Culture',
  adventure: 'Adventure',
  shopping: 'Shopping',
  scenic: 'Scenic',
  other: 'Other',
};

export interface TripPaceOption {
  value: TripPace;
  label: string;
  copy: string;
}

export const TRIP_PLANNER_PACE_OPTIONS: TripPaceOption[] = [
  { value: 'relaxed', label: 'Relaxed', copy: 'Longer meals, softer pacing, and more breathing room.' },
  { value: 'moderate', label: 'Moderate', copy: 'Balance marquee moments with scenic pauses.' },
  { value: 'packed', label: 'Packed', copy: 'Stack the route with high-density adventure energy.' },
];

export const TRIP_PLANNER_BUDGET_BOUNDS = {
  min: 500,
  max: 5000,
  step: 100,
} as const;

export const TRIP_PLANNER_MIN_BUDGET_GAP = 300;

export const TRIP_PLANNER_CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const TRIP_PLANNER_FALLBACK_TIME_SLOTS = ['08:30', '12:30', '16:30', '19:30'] as const;
