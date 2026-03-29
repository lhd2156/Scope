function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
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

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('') || 'AT';
}
