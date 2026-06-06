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
  id?: string;
  title?: string;
  city?: string;
  country?: string;
  adminArea?: string;
  province?: string;
  region?: string;
  state?: string;
  stateCode?: string;
}

export interface CityRegionLocation {
  city: string;
  region: string;
  country: string;
  label: string;
}

const UNITED_STATES_COUNTRY_ALIASES = new Set(['us', 'usa', 'united states', 'united states of america']);

const CITY_REGION_FALLBACKS = new Map<string, string>([
  ['arlington', 'TX'],
  ['austin', 'TX'],
  ['big bend national park', 'TX'],
  ['barcelona', 'Catalonia'],
  ['cape town', 'Western Cape'],
  ['cuero', 'TX'],
  ['dallas', 'TX'],
  ['denver', 'CO'],
  ['fort worth', 'TX'],
  ['houston', 'TX'],
  ['london', 'England'],
  ['los angeles', 'CA'],
  ['miami', 'FL'],
  ['new orleans', 'LA'],
  ['new york', 'NY'],
  ['san antonio', 'TX'],
  ['seattle', 'WA'],
  ['singapore', 'Singapore'],
  ['sterling city', 'TX'],
  ['chicago', 'IL'],
  ['lisbon', 'Lisbon'],
  ['mexico city', 'CDMX'],
  ['sydney', 'NSW'],
  ['tokyo', 'Tokyo'],
  ['vancouver', 'BC'],
]);

const SEEDED_SPOT_LOCATIONS = [
  ['90000000-0000-0000-0000-000000000001', 'Mule Alley Mercantile Row', 'Fort Worth', 'TX', 'US'],
  ['90000000-0000-0000-0000-000000000002', 'San Antonio River Walk Blue Hour', 'San Antonio', 'TX', 'US'],
  ['90000000-0000-0000-0000-000000000003', 'Fort Worth Water Gardens', 'Fort Worth', 'TX', 'US'],
  ['90000000-0000-0000-0000-000000000004', 'Pearl District Market Hall', 'San Antonio', 'TX', 'US'],
  ['90000000-0000-0000-0000-000000000005', 'Lady Bird Skyline Boardwalk', 'Austin', 'TX', 'US'],
  ['90000000-0000-0000-0000-000000000006', 'Klyde Warren Park Lawn', 'Dallas', 'TX', 'US'],
  ['90000000-0000-0000-0000-000000000007', 'Buffalo Bayou Skyline Run', 'Houston', 'TX', 'US'],
  ['90000000-0000-0000-0000-000000000008', 'Big Bend Window Trail', 'Big Bend National Park', 'TX', 'US'],
  ['90000000-0000-0000-0000-000000000009', 'Historic Market Square San Antonio', 'San Antonio', 'TX', 'US'],
  ['90000000-0000-0000-0000-000000000010', 'Millennium Park Bean Loop', 'Chicago', 'IL', 'US'],
  ['90000000-0000-0000-0000-000000000011', 'Empire State Observation Window', 'New York', 'NY', 'US'],
  ['90000000-0000-0000-0000-000000000012', 'Pike Place Market Morning', 'Seattle', 'WA', 'US'],
  ['90000000-0000-0000-0000-000000000013', 'Wynwood Walls Color Walk', 'Miami', 'FL', 'US'],
  ['90000000-0000-0000-0000-000000000014', 'Walt Disney Concert Hall Curve', 'Los Angeles', 'CA', 'US'],
  ['90000000-0000-0000-0000-000000000015', 'Denver Union Station Great Hall', 'Denver', 'CO', 'US'],
  ['90000000-0000-0000-0000-000000000016', 'Jackson Square Brass Corner', 'New Orleans', 'LA', 'US'],
  ['90000000-0000-0000-0000-000000000017', 'Shibuya Crossing Pulse', 'Tokyo', 'Tokyo', 'JP'],
  ['90000000-0000-0000-0000-000000000018', 'Senso-ji Lantern Approach', 'Tokyo', 'Tokyo', 'JP'],
  ['90000000-0000-0000-0000-000000000019', 'Park Guell Mosaic Terrace', 'Barcelona', 'Catalonia', 'ES'],
  ['90000000-0000-0000-0000-000000000020', 'Portobello Road Market Stroll', 'London', 'England', 'GB'],
  ['90000000-0000-0000-0000-000000000021', 'Gardens by the Bay Supertree Walk', 'Singapore', 'Singapore', 'SG'],
  ['90000000-0000-0000-0000-000000000022', 'V&A Waterfront Table Mountain View', 'Cape Town', 'Western Cape', 'ZA'],
  ['90000000-0000-0000-0000-000000000023', 'Palacio de Bellas Artes Marble Steps', 'Mexico City', 'CDMX', 'MX'],
  ['90000000-0000-0000-0000-000000000024', 'Sydney Opera House Circular Quay', 'Sydney', 'NSW', 'AU'],
] as const satisfies ReadonlyArray<readonly [string, string, string, string, string]>;

const SEEDED_SPOT_LOCATIONS_BY_ID = new Map(
  SEEDED_SPOT_LOCATIONS.map(([id, title, city, region, country]) => [
    id,
    { city, region, country, title },
  ]),
);

function normalizeLocationLookupText(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SEEDED_SPOT_LOCATIONS_BY_TITLE = new Map(
  SEEDED_SPOT_LOCATIONS.map(([id, title, city, region, country]) => [
    normalizeLocationLookupText(title),
    { id, city, region, country },
  ]),
);

function formatCityRegionLabel(city: string, region: string, country: string): string {
  if (city && region) {
    return `${city}, ${formatLocationRegionLabel(region)}`;
  }

  const countryLabel = formatCountryLabel(country);
  return city ? (countryLabel ? `${city}, ${countryLabel}` : city) : countryLabel;
}

function resolveSeededSpotLocation(location: RegionAwareLocation): CityRegionLocation | null {
  const seededLocation =
    SEEDED_SPOT_LOCATIONS_BY_ID.get((location.id ?? '').trim().toLowerCase()) ??
    SEEDED_SPOT_LOCATIONS_BY_TITLE.get(normalizeLocationLookupText(location.title));

  if (!seededLocation) {
    return null;
  }

  const country = formatCountryLabel(seededLocation.country);
  const label = formatCityRegionLabel(seededLocation.city, seededLocation.region, country);

  return {
    city: seededLocation.city,
    region: seededLocation.region,
    country,
    label,
  };
}

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

export function resolveCityRegionLocation(location: RegionAwareLocation): CityRegionLocation | null {
  const city = location.city?.trim() ?? '';

  if (city) {
    const region = resolveLocationRegion(location, { allowCountryFallback: false });
    const country = formatCountryLabel(location.country);
    const filterRegion = region || country;
    const label = formatCityRegionLabel(city, region, country);

    return {
      city,
      region: filterRegion,
      country,
      label,
    };
  }

  return resolveSeededSpotLocation(location);
}

export function formatCityRegionLocation(location: RegionAwareLocation, fallback = 'Scope community pin'): string {
  const resolvedLocation = resolveCityRegionLocation(location);

  return resolvedLocation?.label || formatCountryLabel(location.country) || fallback;
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
