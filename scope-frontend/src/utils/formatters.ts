const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

function toDate(value: string | Date): Date {
  if (value instanceof Date) {
    return value;
  }

  if (calendarDatePattern.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

function toCalendarDate(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function toCalendarDayNumber(value: string | Date): number {
  const date = toDate(value);

  if (Number.isNaN(date.getTime())) {
    return Number.NaN;
  }

  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / millisecondsPerDay;
}

const relativeTimeUnits = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
] as const satisfies ReadonlyArray<{ amount: number; unit: Intl.RelativeTimeFormatUnit }>;

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const monthDayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const weekdayMonthDayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

export function formatRelativeTime(value: string | Date, baseDate: string | Date = new Date()): string {
  const targetDate = toDate(value);
  const comparisonDate = toDate(baseDate);

  if (Number.isNaN(targetDate.getTime()) || Number.isNaN(comparisonDate.getTime())) {
    return '';
  }

  let delta = (targetDate.getTime() - comparisonDate.getTime()) / 1000;

  for (const { amount, unit } of relativeTimeUnits) {
    if (Math.abs(delta) < amount) {
      return relativeTimeFormatter.format(Math.round(delta), unit);
    }

    delta /= amount;
  }

  return relativeTimeFormatter.format(Math.round(delta), 'year');
}

export function formatMonthDay(value: string | Date): string {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '' : monthDayFormatter.format(date);
}

export function formatWeekdayMonthDay(value: string | Date): string {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '' : weekdayMonthDayFormatter.format(date);
}

export function getInclusiveDaySpan(start: string | Date, end: string | Date): number {
  const startDayNumber = toCalendarDayNumber(start);
  const endDayNumber = toCalendarDayNumber(end);

  if (Number.isNaN(startDayNumber) || Number.isNaN(endDayNumber)) {
    return 1;
  }

  return Math.max(1, endDayNumber - startDayNumber + 1);
}

export function addCalendarDays(value: string | Date, offsetDays: number): string {
  const date = toDate(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays);
  return toCalendarDate(nextDate);
}

export function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase() ?? '')
      .join('') || 'AT'
  );
}

/**
 * Title-cases vibe tags for UI (e.g. "electric" → "Electric", "golden hour" → "Golden Hour").
 * Splits on spaces and hyphens; normalizes each word to Capitalized form.
 */
export function formatVibeLabel(vibe: string): string {
  const trimmed = vibe.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Map pin subline: drop commas in city/region so the line reads "Dallas ★ 4.6" not "Dallas, TX , ★".
 */
export function formatMapPinCityLine(city: string | undefined): string {
  if (!city?.trim()) {
    return 'Scope spot';
  }

  return city
    .replace(/,+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
