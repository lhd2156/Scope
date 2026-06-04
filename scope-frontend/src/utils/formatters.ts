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

export function formatCategoryLabel(category: string | undefined): string {
  if (!category) {
    return '';
  }

  return category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Title-cases vibe tags for UI (e.g. "electric" -> "Electric", "golden hour" -> "Golden Hour").
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
 * Map pin subline: drop commas in city/region so the line reads "Dallas star 4.6" not "Dallas, TX , star".
 */
export interface RegionAwareLocation {
  city?: string;
  country?: string;
  adminArea?: string;
  province?: string;
  region?: string;
  state?: string;
  stateCode?: string;
}

const UNITED_STATES_COUNTRY_ALIASES = new Set(['us', 'usa', 'united states', 'united states of america']);

const CITY_REGION_FALLBACKS = new Map<string, string>([
  ['arlington', 'TX'],
  ['austin', 'TX'],
  ['big bend national park', 'TX'],
  ['cuero', 'TX'],
  ['dallas', 'TX'],
  ['fort worth', 'TX'],
  ['houston', 'TX'],
  ['san antonio', 'TX'],
  ['sterling city', 'TX'],
  ['chicago', 'IL'],
  ['lisbon', 'Lisbon'],
  ['mexico city', 'CDMX'],
  ['tokyo', 'Tokyo'],
  ['vancouver', 'BC'],
]);

function normalizeRegionCode(value: string | undefined): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return '';
  }

  return normalized.length <= 3 ? normalized.toUpperCase() : normalized;
}

function isUnitedStatesCountry(value: string | undefined): boolean {
  return UNITED_STATES_COUNTRY_ALIASES.has(value?.trim().toLowerCase() ?? '');
}

export function formatCountryLabel(country: string | undefined): string {
  const normalizedCountry = country?.trim();
  if (!normalizedCountry) {
    return '';
  }

  if (isUnitedStatesCountry(normalizedCountry)) {
    return 'USA';
  }

  return normalizedCountry.length <= 3 ? normalizedCountry.toUpperCase() : normalizedCountry;
}

export function formatLocationRegionLabel(region: string): string {
  return normalizeRegionCode(region);
}

export function resolveLocationRegion(location: RegionAwareLocation, options: { allowCountryFallback?: boolean } = {}): string {
  const explicitRegion = normalizeRegionCode(
    location.stateCode ||
      location.state ||
      location.region ||
      location.province ||
      location.adminArea,
  );

  if (explicitRegion) {
    return explicitRegion;
  }

  const cityRegion = CITY_REGION_FALLBACKS.get((location.city ?? '').trim().toLowerCase());
  if (cityRegion) {
    return cityRegion;
  }

  return options.allowCountryFallback ? formatCountryLabel(location.country) : '';
}

export function formatCityRegionLocation(location: RegionAwareLocation, fallback = 'Scope community pin'): string {
  const city = location.city?.trim() ?? '';
  const region = resolveLocationRegion(location, { allowCountryFallback: false });

  if (city && region) {
    return `${city}, ${formatLocationRegionLabel(region)}`;
  }

  if (city) {
    const country = formatCountryLabel(location.country);
    return country ? `${city}, ${country}` : city;
  }

  return formatCountryLabel(location.country) || fallback;
}

export function formatMapPinCityLine(city: string | undefined): string {
  if (!city?.trim()) {
    return 'Scope spot';
  }

  return city
    .replace(/,+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
