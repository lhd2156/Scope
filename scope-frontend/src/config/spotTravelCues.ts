import type { SpotCategory } from '@/types';

export interface TravelCue {
  window: string;
  pairing: string;
  energy: string;
}

// Short-form "vibe cues" surfaced in SpotDetail to hint when / why a visitor
// would slot a given category of spot into an itinerary. Purely static copy.
export const SPOT_TRAVEL_CUES: Record<SpotCategory, TravelCue> = {
  food: {
    window: 'Golden hour dinner run',
    pairing: 'Culture + nightlife',
    energy: 'Social anchor stop',
  },
  nature: {
    window: 'Sunrise to late morning',
    pairing: 'Scenic + adventure',
    energy: 'Slow recharge moment',
  },
  nightlife: {
    window: 'After dark peak hours',
    pairing: 'Food + live music',
    energy: 'High-energy closer',
  },
  culture: {
    window: 'Late morning to sunset',
    pairing: 'Food + shopping',
    energy: 'Story-rich midpoint',
  },
  adventure: {
    window: 'Early morning through midday',
    pairing: 'Nature + scenic',
    energy: 'Hero itinerary anchor',
  },
  shopping: {
    window: 'Midday browse window',
    pairing: 'Culture + food',
    energy: 'Polished flex stop',
  },
  entertainment: {
    window: 'Afternoon through evening',
    pairing: 'Food + nightlife',
    energy: 'Fun-forward anchor',
  },
  scenic: {
    window: 'Sunrise or golden hour',
    pairing: 'Nature + food',
    energy: 'Camera-first pause',
  },
  other: {
    window: 'Flexible all-day stop',
    pairing: 'Nearby community pins',
    energy: 'Utility route filler',
  },
};
