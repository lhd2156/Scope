import { describe, expect, it } from 'vitest';
import {
  clampTimelineDayNumber,
  compareTimelineStops,
  formatCoordinateLabel,
  formatTimelineSpotReason,
  getTimelineSpotBadgeText,
  hasCoordinatePair,
  isSyntheticTimelineEndpoint,
  labelTimelineStops,
  normalizeTimeSlot,
  parseTimelineTimeInput,
  stripTimelineMetadata,
  type TimelineTripSpot,
} from '@/components/trips/itineraryTimelineHelpers';

function makeSpot(overrides: Partial<TimelineTripSpot> = {}): TimelineTripSpot {
  return {
    spotId: 'spot-1',
    title: 'Scope Stop',
    latitude: 32.7767,
    longitude: -96.797,
    category: 'scenic',
    ...overrides,
  };
}

describe('itinerary timeline helpers', () => {
  it('parses and normalizes timeline time inputs exactly like the component did', () => {
    expect(parseTimelineTimeInput('8')).toBe('08:00');
    expect(parseTimelineTimeInput('815')).toBe('08:15');
    expect(parseTimelineTimeInput('18:5')).toBe('18:05');
    expect(parseTimelineTimeInput(' 09 : 30 ')).toBe('09:30');
    expect(parseTimelineTimeInput('25:00')).toBeNull();
    expect(parseTimelineTimeInput('12:99')).toBeNull();
    expect(parseTimelineTimeInput('')).toBeNull();

    expect(normalizeTimeSlot('bad', 0)).toBe('10:00');
    expect(normalizeTimeSlot('bad', 4)).toBe('13:00');
    expect(normalizeTimeSlot('7:5', 2)).toBe('07:05');
  });

  it('keeps coordinate labels and day clamping behavior stable', () => {
    expect(hasCoordinatePair(32.7767, -96.797)).toBe(true);
    expect(hasCoordinatePair(91, -96.797)).toBe(false);
    expect(hasCoordinatePair(32.7767, -181)).toBe(false);
    expect(formatCoordinateLabel(32.7767, -96.797)).toBe('32.7767, -96.7970');
    expect(formatCoordinateLabel(undefined, -96.797)).toBe('');

    expect(clampTimelineDayNumber(Number.NaN)).toBe(1);
    expect(clampTimelineDayNumber(-4)).toBe(1);
    expect(clampTimelineDayNumber(2.6)).toBe(3);
    expect(clampTimelineDayNumber(35, 14)).toBe(14);
  });

  it('labels timeline stops and badges without changing endpoint semantics', () => {
    const labeled = labelTimelineStops([
      makeSpot({ spotId: 'start', timelineRouteRole: 'start' }),
      makeSpot({ spotId: 'middle' }),
      makeSpot({ spotId: 'end', timelineRouteRole: 'end' }),
    ]);

    expect(labeled.map((spot) => [spot.timelineRouteRole, spot.timelineRouteLabel])).toEqual([
      ['start', 'S'],
      ['stop', '2'],
      ['end', 'E'],
    ]);
    expect(getTimelineSpotBadgeText(labeled[0]!)).toBe('Origin');
    expect(getTimelineSpotBadgeText(labeled[1]!)).toBe('Stop 2');
    expect(getTimelineSpotBadgeText(labeled[2]!)).toBe('Destination');

    const chronological = labelTimelineStops([
      makeSpot({ spotId: 'first' }),
      makeSpot({ spotId: 'second' }),
    ], true);
    expect(chronological.map((spot) => [spot.timelineRouteRole, spot.timelineRouteLabel])).toEqual([
      ['start', 'S'],
      ['end', 'E'],
    ]);
  });

  it('formats reasons, strips helper metadata, and sorts by day, time, then title', () => {
    expect(formatTimelineSpotReason(makeSpot({
      confidence: 1.2,
      reason: ' Keeps the route tight. ',
    }))).toBe('100% match - Keeps the route tight.');
    expect(formatTimelineSpotReason(makeSpot({
      timelineRouteRole: 'start',
      confidence: 0.8,
      reason: 'Hidden',
    }))).toBe('');

    const endpoint = makeSpot({
      isTimelineEndpoint: true,
      timelineRouteLabel: 'S',
      timelineRouteRole: 'start',
    });
    expect(isSyntheticTimelineEndpoint(endpoint)).toBe(true);
    expect(stripTimelineMetadata(endpoint)).toEqual({
      spotId: 'spot-1',
      title: 'Scope Stop',
      latitude: 32.7767,
      longitude: -96.797,
      category: 'scenic',
    });

    const sorted = [
      makeSpot({ title: 'Beta', dayNumber: 2, timeSlot: '10:00' }),
      makeSpot({ title: 'Gamma', dayNumber: 1, timeSlot: '13:00' }),
      makeSpot({ title: 'Alpha', dayNumber: 1, timeSlot: '13:00' }),
      makeSpot({ title: 'Morning', dayNumber: 1, timeSlot: '9' }),
    ].sort(compareTimelineStops);

    expect(sorted.map((spot) => spot.title)).toEqual(['Morning', 'Alpha', 'Gamma', 'Beta']);
  });
});
