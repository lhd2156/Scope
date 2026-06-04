import type { Itinerary, ItineraryDay, TripMember, TripPace, TripPlannerInput, TripSpot } from '@/types';
import { buildInitialsAvatarUrl } from '@/utils/demoMedia';
import { getInclusiveDaySpan } from '@/utils/formatters';

export interface TripPlannerPreset {
  key: string;
  tripTitle: string;
  destination: string;
  weatherForecast: string;
  budgetRange: readonly [number, number];
  baseBudget: number;
  interests: TripPlannerInput['interests'];
  crew: TripMember[];
  stops: TripSpot[];
  suggestedStops: TripSpot[];
  matchers: string[];
}

const timeSlots = ['08:30', '12:30', '16:30', '19:30'] as const;
const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function cloneStop(stop: TripSpot): TripSpot {
  return {
    ...stop,
  };
}

function cloneMember(member: TripMember): TripMember {
  return {
    ...member,
  };
}

function clonePreset(preset: TripPlannerPreset): TripPlannerPreset {
  return {
    ...preset,
    budgetRange: [...preset.budgetRange] as [number, number],
    interests: [...preset.interests],
    crew: preset.crew.map(cloneMember),
    stops: preset.stops.map(cloneStop),
    suggestedStops: preset.suggestedStops.map(cloneStop),
    matchers: [...preset.matchers],
  };
}

function addCalendarDays(calendarDate: string, offsetDays: number): string {
  const matched = calendarDatePattern.exec(calendarDate);
  if (!matched) {
    return calendarDate;
  }

  const [, year, month, day] = matched;
  const nextDate = new Date(Number(year), Number(month) - 1, Number(day) + offsetDays);

  const nextYear = String(nextDate.getFullYear());
  const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
  const nextDay = String(nextDate.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getTargetStopCount(totalDays: number, pace: TripPace, availableCount: number): number {
  const extraStops = pace === 'packed' ? 2 : pace === 'moderate' ? 1 : 0;
  return Math.min(availableCount, Math.max(totalDays, totalDays + extraStops));
}

const patagoniaPreset: TripPlannerPreset = {
  key: 'patagonia',
  tripTitle: 'Epic Patagonia Trek',
  destination: 'Patagonia, Chile + Argentina',
  weatherForecast: 'Crisp alpine mornings with clear glacier light.',
  budgetRange: [1500, 3000],
  baseBudget: 3000,
  interests: ['adventure', 'nature', 'scenic'],
  crew: [
    {
      id: 'planner-member-1',
      displayName: 'Ava Torres',
      avatarUrl: buildInitialsAvatarUrl('Ava Torres', '163b3a'),
      status: 'lead',
    },
    {
      id: 'planner-member-2',
      displayName: 'Leo Bennett',
      avatarUrl: buildInitialsAvatarUrl('Leo Bennett', '3f2d57'),
      status: 'guide',
    },
    {
      id: 'planner-member-3',
      displayName: 'Noah Patel',
      avatarUrl: buildInitialsAvatarUrl('Noah Patel', '2f4058'),
      status: 'photo',
    },
  ],
  stops: [
    {
      spotId: 'planner-fitz-roy',
      title: 'Mount Fitz Roy',
      latitude: -49.2711,
      longitude: -73.0439,
      category: 'adventure',
      timeSlot: '08:30',
      duration: 180,
      estimatedCost: 180,
      photoUrl: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800',
      city: 'El Chaltén',
      dayNumber: 1,
      notes: 'Start with the signature alpine ascent while the granite faces catch first light.',
    },
    {
      spotId: 'planner-perito-moreno',
      title: 'Perito Moreno Glacier',
      latitude: -50.496,
      longitude: -73.1373,
      category: 'scenic',
      timeSlot: '12:30',
      duration: 150,
      estimatedCost: 210,
      photoUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
      city: 'El Calafate',
      dayNumber: 2,
      notes: 'Layer in a glacier cruise and boardwalk loop for the visual crescendo of the route.',
    },
    {
      spotId: 'planner-torres',
      title: 'Torres del Paine',
      latitude: -50.9423,
      longitude: -72.9874,
      category: 'nature',
      timeSlot: '16:30',
      duration: 210,
      estimatedCost: 240,
      photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
      city: 'Torres del Paine',
      dayNumber: 3,
      notes: 'Finish on the iconic towers for the biggest end-of-day payoff and photo set.',
    },
  ],
  suggestedStops: [
    {
      spotId: 'planner-puerto-natales',
      title: 'Puerto Natales Waterfront',
      latitude: -51.7295,
      longitude: -72.5066,
      category: 'culture',
      timeSlot: '19:30',
      duration: 90,
      estimatedCost: 95,
      photoUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800',
      city: 'Puerto Natales',
      dayNumber: 2,
      notes: 'A harbor-side recovery stop for dinner, gear checks, and softer cultural pacing.',
    },
    {
      spotId: 'planner-ushuaia',
      title: 'Beagle Channel Outlook',
      latitude: -54.8019,
      longitude: -68.303,
      category: 'scenic',
      timeSlot: '08:30',
      duration: 120,
      estimatedCost: 130,
      photoUrl: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=800',
      city: 'Ushuaia',
      dayNumber: 4,
      notes: 'Optional southern extension for a boat ride and dramatic sea-meets-mountain framing.',
    },
  ],
  matchers: ['patagonia', 'fitz roy', 'perito', 'torres', 'ushuaia', 'el chalten', 'el calafate'],
};

const plannerPresets: TripPlannerPreset[] = [patagoniaPreset];

export function matchTripPlannerPreset(destination?: string | null): TripPlannerPreset | null {
  const normalizedDestination = destination?.trim().toLowerCase() ?? '';
  if (!normalizedDestination) {
    return null;
  }

  const matchedPreset = plannerPresets.find((preset) =>
    preset.matchers.some((matcher) => normalizedDestination.includes(matcher)),
  );

  return matchedPreset ? clonePreset(matchedPreset) : null;
}

export function getTripPlannerPreset(destination?: string | null): TripPlannerPreset {
  return matchTripPlannerPreset(destination) ?? clonePreset(patagoniaPreset);
}

function buildPlannerRouteLabel(input: TripPlannerInput): string {
  const startDestination = input.destination.trim();
  const endDestination = input.endDestination?.trim();

  return endDestination ? `${startDestination} to ${endDestination}` : startDestination;
}

function assignPresetStopsToDays(candidateStops: TripSpot[], totalDays: number): ItineraryDay[] {
  const days = Array.from({ length: totalDays }, (_, index) => ({
    dayNumber: index + 1,
    date: '',
    spots: [] as TripSpot[],
  }));

  const stopCountByDay = new Map<number, number>();

  candidateStops.forEach((stop, index) => {
    const dayNumber = index < totalDays ? index + 1 : ((index - totalDays) % totalDays) + 1;
    const nextStopIndex = stopCountByDay.get(dayNumber) ?? 0;
    stopCountByDay.set(dayNumber, nextStopIndex + 1);

    days[dayNumber - 1]?.spots.push({
      ...stop,
      dayNumber,
      timeSlot: timeSlots[nextStopIndex] ?? '20:00',
    });
  });

  return days;
}

export function buildTripPlannerPresetItinerary(input: TripPlannerInput): Itinerary | null {
  const matchedPreset = matchTripPlannerPreset(input.destination);
  if (!matchedPreset) {
    return null;
  }

  const totalDays = Math.max(1, Math.min(getInclusiveDaySpan(input.startDate, input.endDate), 30));
  const presetStops = [...matchedPreset.stops, ...matchedPreset.suggestedStops].map(cloneStop);
  const selectedStopCount = getTargetStopCount(totalDays, input.pace, presetStops.length);
  const selectedStops = presetStops.slice(0, selectedStopCount);

  const days = assignPresetStopsToDays(selectedStops, totalDays)
    .map((day, index) => ({
      ...day,
      date: addCalendarDays(input.startDate, index),
    }));

  const totalEstimatedCost = days
    .flatMap((day) => day.spots)
    .reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);
  const routeLabel = buildPlannerRouteLabel(input);

  return {
    id: `${matchedPreset.key}-${routeLabel.replace(/\s+/g, '-').toLowerCase()}`,
    destination: routeLabel,
    days,
    totalEstimatedCost,
    weatherForecast: matchedPreset.weatherForecast,
  };
}
