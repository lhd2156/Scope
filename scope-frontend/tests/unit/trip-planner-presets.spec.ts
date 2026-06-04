import {
  buildTripPlannerPresetItinerary,
  getTripPlannerPreset,
  matchTripPlannerPreset,
} from '@/services/tripPlannerPresets';

describe('trip planner presets', () => {
  it('matches Patagonia aliases while returning isolated preset copies', () => {
    const firstMatch = matchTripPlannerPreset('Fitz Roy sunrise and Perito Moreno');
    const secondMatch = matchTripPlannerPreset('Torres del Paine');

    expect(firstMatch?.key).toBe('patagonia');
    expect(secondMatch?.key).toBe('patagonia');
    expect(matchTripPlannerPreset('')).toBeNull();
    expect(matchTripPlannerPreset('  unknown desert route  ')).toBeNull();

    firstMatch?.stops.splice(0, firstMatch.stops.length);
    firstMatch?.crew.push({
      id: 'mutated',
      displayName: 'Mutated Member',
      status: 'viewer',
    });

    const freshPreset = getTripPlannerPreset('el calafate');
    expect(freshPreset.stops.length).toBeGreaterThan(0);
    expect(freshPreset.crew.find((member) => member.id === 'mutated')).toBeUndefined();
  });

  it('falls back to the default Patagonia preset for unmatched destinations', () => {
    const fallback = getTripPlannerPreset('Lunar Canyon');

    expect(fallback.key).toBe('patagonia');
    expect(fallback.destination).toContain('Patagonia');
    expect(fallback.budgetRange).toEqual([1500, 3000]);
  });

  it('builds paced preset itineraries with inclusive calendar dates and route labels', () => {
    const itinerary = buildTripPlannerPresetItinerary({
      destination: 'Patagonia',
      endDestination: 'Ushuaia',
      startDate: '2026-06-29',
      endDate: '2026-07-01',
      budget: 3000,
      interests: ['adventure', 'nature'],
      pace: 'packed',
      groupSize: 3,
    });

    expect(itinerary?.id).toBe('patagonia-patagonia-to-ushuaia');
    expect(itinerary?.destination).toBe('Patagonia to Ushuaia');
    expect(itinerary?.days).toHaveLength(3);
    expect(itinerary?.days.map((day) => day.date)).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
    ]);
    expect(itinerary?.days.flatMap((day) => day.spots)).toHaveLength(5);
    expect(itinerary?.days[0]?.spots.map((spot) => spot.timeSlot)).toEqual(['08:30', '12:30']);
    expect(itinerary?.totalEstimatedCost).toBeGreaterThan(0);
    expect(itinerary?.weatherForecast).toContain('alpine');
  });

  it('keeps slow routes to one stop per day and clamps long ranges to thirty days', () => {
    const itinerary = buildTripPlannerPresetItinerary({
      destination: 'Torres',
      startDate: '2026-01-01',
      endDate: '2026-03-15',
      budget: 2500,
      interests: ['scenic'],
      pace: 'slow',
      groupSize: 1,
    });

    expect(itinerary?.days).toHaveLength(30);
    expect(itinerary?.days.flatMap((day) => day.spots)).toHaveLength(5);
    expect(itinerary?.days.slice(0, 5).every((day) => day.spots.length === 1)).toBe(true);
    expect(itinerary?.days.at(-1)?.date).toBe('2026-01-30');
  });

  it('returns null for unmatched itinerary destinations and preserves invalid date text', () => {
    expect(buildTripPlannerPresetItinerary({
      destination: 'Moon Base',
      startDate: '2026-01-01',
      endDate: '2026-01-03',
      budget: 1000,
      interests: ['scenic'],
      pace: 'moderate',
      groupSize: 2,
    })).toBeNull();

    const itinerary = buildTripPlannerPresetItinerary({
      destination: 'Ushuaia',
      startDate: 'not-a-date',
      endDate: 'not-a-date',
      budget: 1000,
      interests: ['scenic'],
      pace: 'moderate',
      groupSize: 2,
    });

    expect(itinerary?.days).toHaveLength(1);
    expect(itinerary?.days[0]?.date).toBe('not-a-date');
  });
});
