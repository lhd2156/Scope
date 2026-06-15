import type { TripSpot } from '@/types';

export type TimelineRouteRole = 'start' | 'stop' | 'end';

export type TimelineTripSpot = TripSpot & {
  timelineRouteLabel?: string;
  timelineRouteRole?: TimelineRouteRole;
  isTimelineEndpoint?: boolean;
};

export const MAX_REASONABLE_TIMELINE_DAYS = 30;
export const TIMELINE_START_TIME_SLOT = '08:30';
export const TIMELINE_END_TIME_SLOT = '18:00';
export const DEFAULT_TIMELINE_TIME_SLOTS = ['10:00', '13:00', '16:00'];
export const TIMELINE_START_ENDPOINT_ID = 'timeline-endpoint-start';
export const TIMELINE_END_ENDPOINT_ID = 'timeline-endpoint-end';

export function hasCoordinatePair(latitude: number | undefined, longitude: number | undefined): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Number(latitude) >= -90 &&
    Number(latitude) <= 90 &&
    Number(longitude) >= -180 &&
    Number(longitude) <= 180;
}

export function parseTimelineTimeInput(value: string | undefined): string | null {
  const compactValue = String(value ?? '').trim().replace(/\s+/g, '');
  if (!compactValue) {
    return null;
  }

  let hourText = '';
  let minuteText = '00';
  const colonMatch = /^(\d{1,2})(?::(\d{0,2}))?$/.exec(compactValue);

  if (colonMatch) {
    hourText = colonMatch[1] ?? '';
    const rawMinutes = colonMatch[2];
    minuteText = rawMinutes ? rawMinutes.padStart(2, '0') : '00';
  } else if (/^\d{1,2}$/.test(compactValue)) {
    hourText = compactValue;
  } else if (/^\d{3}$/.test(compactValue)) {
    hourText = compactValue.slice(0, 1);
    minuteText = compactValue.slice(1);
  } else if (/^\d{4}$/.test(compactValue)) {
    hourText = compactValue.slice(0, 2);
    minuteText = compactValue.slice(2);
  } else {
    return null;
  }

  if (!/^\d{1,2}$/.test(hourText) || !/^\d{2}$/.test(minuteText)) {
    return null;
  }

  const hour = Number.parseInt(hourText, 10);
  const minutes = Number.parseInt(minuteText, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minutes) || hour < 0 || hour > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function normalizeTimeSlot(value: string | undefined, fallbackIndex = 0): string {
  const parsedTime = parseTimelineTimeInput(value);
  if (parsedTime) {
    return parsedTime;
  }

  return DEFAULT_TIMELINE_TIME_SLOTS[fallbackIndex % DEFAULT_TIMELINE_TIME_SLOTS.length] ?? '09:00';
}

export function clampTimelineDayNumber(value: number, maxDay = MAX_REASONABLE_TIMELINE_DAYS): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(1, maxDay), Math.max(1, Math.round(value)));
}

export function formatCoordinateLabel(latitude: number | undefined, longitude: number | undefined): string {
  if (!hasCoordinatePair(latitude, longitude)) {
    return '';
  }

  return `${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`;
}

export function labelTimelineStops(stops: TimelineTripSpot[], useChronologicalEndpoints = false): TimelineTripSpot[] {
  const lastIndex = stops.length - 1;

  return stops.map((stop, index) => {
    if (useChronologicalEndpoints) {
      const timelineRouteRole: TimelineRouteRole = index === 0
        ? 'start'
        : index === lastIndex
          ? 'end'
          : 'stop';
      const timelineRouteLabel = timelineRouteRole === 'start'
        ? 'S'
        : timelineRouteRole === 'end'
          ? 'E'
          : String(index + 1);

      return { ...stop, timelineRouteLabel, timelineRouteRole };
    }

    if (stop.timelineRouteRole === 'start') {
      return { ...stop, timelineRouteLabel: 'S' };
    }

    if (stop.timelineRouteRole === 'end') {
      return { ...stop, timelineRouteLabel: 'E' };
    }

    return { ...stop, timelineRouteLabel: String(index + 1), timelineRouteRole: 'stop' };
  });
}

export function getTimelineSpotBadgeText(spot: TimelineTripSpot): string {
  if (spot.timelineRouteRole === 'start') {
    return 'Origin';
  }

  if (spot.timelineRouteRole === 'end') {
    return 'Destination';
  }

  return `Stop ${spot.timelineRouteLabel || '1'}`;
}

export function formatTimelineSpotReason(spot: TimelineTripSpot): string {
  if (spot.timelineRouteRole === 'start' || spot.timelineRouteRole === 'end') {
    return '';
  }

  const reason = String(spot.reason ?? '').trim();
  const confidence = typeof spot.confidence === 'number' && Number.isFinite(spot.confidence)
    ? `${Math.round(Math.min(1, Math.max(0, spot.confidence)) * 100)}% match`
    : '';

  return [confidence, reason].filter(Boolean).join(' - ');
}

export function isSyntheticTimelineEndpoint(spot: TimelineTripSpot): boolean {
  return spot.isTimelineEndpoint === true;
}

export function stripTimelineMetadata(stop: TimelineTripSpot): TripSpot {
  const {
    timelineRouteLabel: _timelineRouteLabel,
    timelineRouteRole: _timelineRouteRole,
    isTimelineEndpoint: _isTimelineEndpoint,
    ...tripSpot
  } = stop;
  return { ...tripSpot };
}

export function compareTimelineStops(left: TimelineTripSpot, right: TimelineTripSpot): number {
  const dayComparison = (left.dayNumber ?? 1) - (right.dayNumber ?? 1);
  if (dayComparison !== 0) {
    return dayComparison;
  }

  const timeComparison = normalizeTimeSlot(left.timeSlot).localeCompare(normalizeTimeSlot(right.timeSlot));
  if (timeComparison !== 0) {
    return timeComparison;
  }

  return left.title.localeCompare(right.title);
}
