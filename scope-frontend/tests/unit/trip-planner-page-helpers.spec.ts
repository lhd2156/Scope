import {
  buildGeneratedDraftTitle,
  buildPlannerDraftAutosaveSignature,
  buildRouteLibraryPhotoCacheKey,
  getRouteLibraryEndpointLabels,
  hasAutosavablePlannerDraftInput,
  hasAutosavablePlannerRouteContent,
  isCoordinatePair,
  normalizeRouteLibraryImageKey,
  sanitizeFuelType,
  splitRouteDestinationLabel,
} from '@/views/tripPlannerPageHelpers';
import type { TripPlannerInput, TripSpot } from '@/types';

const blankDraft: TripPlannerInput = {
  destination: '',
  endDestination: '',
  startDate: '2026-06-14',
  endDate: '2026-06-14',
  budgetFloor: 500,
  budget: 1500,
  interests: [],
  pace: 'relaxed',
  groupSize: 1,
};

function buildStop(overrides: Partial<TripSpot> = {}): TripSpot {
  return {
    spotId: 'stop-1',
    title: 'Fort Worth Stockyards',
    city: 'Fort Worth, Texas, United States',
    category: 'culture',
    latitude: 32.78842,
    longitude: -97.34859,
    ...overrides,
  };
}

describe('tripPlannerPageHelpers', () => {
  it('preserves generated title normalization for addresses and endpoints', () => {
    expect(buildGeneratedDraftTitle({
      destination: '123 Main Street, Fort Worth, TX',
      endDestination: 'Dallas Arts District, Dallas, TX',
    })).toBe('Fort Worth to Dallas Arts District');

    expect(buildGeneratedDraftTitle({
      destination: '',
      endDestination: '',
    })).toBe('Untitled trip');
  });

  it('preserves route destination splitting and endpoint label compaction', () => {
    expect(splitRouteDestinationLabel('Fort Worth + Dallas -> Austin')).toEqual({
      start: 'Fort Worth to Dallas',
      end: 'Austin',
    });

    expect(getRouteLibraryEndpointLabels(
      { destination: 'Fort Worth, Texas, United States to Dallas, Texas, United States' },
      [
        buildStop({ title: 'Start' }),
        buildStop({ title: 'End', city: 'Dallas, Texas, United States' }),
      ],
    )).toEqual({
      start: 'Fort Worth, Texas',
      end: 'Dallas, Texas',
      routeLabel: 'Fort Worth, Texas to Dallas, Texas',
    });
  });

  it('preserves image key, coordinate, fuel, and photo cache normalization', () => {
    expect(normalizeRouteLibraryImageKey('https://images.unsplash.com/photo-1?w=400&auto=format')).toBe('https://images.unsplash.com/photo-1');
    expect(isCoordinatePair(32.78842, -97.34859)).toBe(true);
    expect(isCoordinatePair(120, -97.34859)).toBe(false);
    expect(sanitizeFuelType('Premium')).toBe('premium');
    expect(sanitizeFuelType('rocket' as never)).toBeUndefined();
    expect(buildRouteLibraryPhotoCacheKey(buildStop())).toBe('fort worth stockyards|fort worth texas|32.78842|-97.34859|720');
  });

  it('preserves autosavable draft and route content checks', () => {
    expect(hasAutosavablePlannerDraftInput({
      title: '',
      draft: blankDraft,
      stops: [],
      isPublic: false,
      todayDateInput: '2026-06-14',
    })).toBe(false);

    expect(hasAutosavablePlannerDraftInput({
      title: ' Weekend Route ',
      draft: blankDraft,
      stops: [],
      isPublic: false,
      todayDateInput: '2026-06-14',
    })).toBe(true);

    expect(hasAutosavablePlannerDraftInput({
      title: '',
      draft: { ...blankDraft, startDate: '2026-06-15' },
      stops: [],
      isPublic: false,
      todayDateInput: '2026-06-14',
    })).toBe(true);

    expect(hasAutosavablePlannerRouteContent({
      draft: blankDraft,
      stops: [],
      previewStopCount: 0,
    })).toBe(false);

    expect(hasAutosavablePlannerRouteContent({
      draft: blankDraft,
      stops: [],
      previewStopCount: 2,
    })).toBe(true);
  });

  it('preserves autosave signature normalization and stop defaults', () => {
    const signature = buildPlannerDraftAutosaveSignature({
      title: ' Fort Worth Sprint ',
      draft: {
        ...blankDraft,
        destination: ' Fort Worth ',
        endDestination: ' Dallas ',
        destinationLatitude: 32.75,
        destinationLongitude: -97.33,
        interests: ['nightlife', 'food'],
        budgetFloor: undefined,
      },
      stops: [buildStop({
        timeSlot: undefined,
        duration: undefined,
        estimatedCost: undefined,
        photoUrl: undefined,
        city: undefined,
        dayNumber: undefined,
        notes: undefined,
      })],
      isPublic: true,
    });

    expect(JSON.parse(signature)).toEqual({
      title: 'Fort Worth Sprint',
      destination: 'Fort Worth',
      endDestination: 'Dallas',
      destinationLatitude: 32.75,
      destinationLongitude: -97.33,
      endDestinationLatitude: null,
      endDestinationLongitude: null,
      startDate: '2026-06-14',
      endDate: '2026-06-14',
      budgetFloor: 500,
      budget: 1500,
      interests: ['food', 'nightlife'],
      pace: 'relaxed',
      groupSize: 1,
      isPublic: true,
      stops: [{
        spotId: 'stop-1',
        title: 'Fort Worth Stockyards',
        timeSlot: '',
        duration: null,
        latitude: 32.78842,
        longitude: -97.34859,
        category: 'culture',
        estimatedCost: null,
        photoUrl: '',
        city: '',
        dayNumber: null,
        notes: '',
      }],
    });
  });
});
