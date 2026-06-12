import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  formatCategoryLabel,
  formatCityRegionLocation,
  formatHomeBaseLocation,
  formatCountryLabel,
  formatMapPinCityLine,
  formatMonthDay,
  formatMonthDayYear,
  formatPostTimestamp,
  formatRelativeTime,
  formatVibeLabel,
  formatWeekdayMonthDay,
  getInclusiveDaySpan,
  getInitials,
  resolveCityRegionLocation,
  resolveLocationRegion,
} from '@/utils/formatters';

describe('formatVibeLabel', () => {
  it('title-cases single words and normalizes case', () => {
    expect(formatVibeLabel('electric')).toBe('Electric');
    expect(formatVibeLabel('ELECTRIC')).toBe('Electric');
  });

  it('title-cases multi-word and hyphenated vibes', () => {
    expect(formatVibeLabel('golden hour')).toBe('Golden Hour');
    expect(formatVibeLabel('golden-hour')).toBe('Golden Hour');
    expect(formatVibeLabel('electric skyline')).toBe('Electric Skyline');
  });

  it('trims whitespace', () => {
    expect(formatVibeLabel('  calm  ')).toBe('Calm');
  });

  it('returns empty string for empty input', () => {
    expect(formatVibeLabel('')).toBe('');
    expect(formatVibeLabel('   ')).toBe('');
  });
});

describe('formatMapPinCityLine', () => {
  it('strips commas and extra spaces for map pin sublines', () => {
    expect(formatMapPinCityLine('Dallas, TX')).toBe('Dallas TX');
    expect(formatMapPinCityLine('Dallas,  TX')).toBe('Dallas TX');
    expect(formatMapPinCityLine('Dallas,')).toBe('Dallas');
  });

  it('uses fallback when city is empty', () => {
    expect(formatMapPinCityLine('')).toBe('Scope spot');
    expect(formatMapPinCityLine(undefined)).toBe('Scope spot');
  });
});

describe('date and identity formatters', () => {
  it('formats relative time, month/day labels, and inclusive day spans', () => {
    expect(formatRelativeTime('2026-05-20T12:01:00Z', '2026-05-20T12:00:00Z')).toContain('in 1 minute');
    expect(formatRelativeTime('2026-05-20T12:00:30Z', '2026-05-20T12:00:00Z')).toBe('in 30 seconds');
    expect(formatRelativeTime('2026-05-20T14:00:00Z', '2026-05-20T12:00:00Z')).toBe('in 2 hours');
    expect(formatRelativeTime('2026-05-19T23:59:00', '2026-05-20T00:01:00')).toBe('1 day ago');
    expect(formatRelativeTime('2026-05-23T09:00:00', '2026-05-20T23:00:00')).toBe('in 3 days');
    expect(formatRelativeTime('2026-07-20', '2026-05-20')).toBe('in 2 months');
    expect(formatRelativeTime('2027-05-20', '2026-05-20')).toBe('in 1 year');
    expect(formatRelativeTime('not-a-date', '2026-05-20T12:00:00Z')).toBe('');
    expect(formatRelativeTime('2026-05-20T12:00:00Z', 'not-a-date')).toBe('');
    expect(formatMonthDay('2026-05-20')).toContain('May');
    expect(formatMonthDayYear('2026-06-08T12:00:00Z')).toBe('Jun 8, 2026');
    expect(formatPostTimestamp('2026-06-01T12:00:00Z', '2026-06-08T12:00:00Z')).toBe('1 week ago');
    expect(formatPostTimestamp('2026-05-20T12:00:00Z', '2026-06-08T12:00:00Z')).toBe('May 20, 2026');
    expect(formatPostTimestamp('bad', '2026-06-08T12:00:00Z')).toBe('');
    expect(formatPostTimestamp('2026-06-08T12:00:00Z', 'bad')).toBe('');
    expect(formatPostTimestamp('2026-06-08T12:00:00Z')).toMatch(/\d|ago|in|today|yesterday|tomorrow/i);
    expect(formatMonthDay('not-a-date')).toBe('');
    expect(formatMonthDayYear('not-a-date')).toBe('');
    expect(formatWeekdayMonthDay('not-a-date')).toBe('');
    expect(formatWeekdayMonthDay('2026-05-20')).toContain('May');
    expect(getInclusiveDaySpan('2026-05-20', '2026-05-22')).toBe(3);
    expect(getInclusiveDaySpan('2026-05-22', '2026-05-20')).toBe(1);
    expect(getInclusiveDaySpan('bad', '2026-05-22')).toBe(1);
    expect(addCalendarDays('2026-05-20', 2)).toBe('2026-05-22');
    expect(addCalendarDays('bad', 2)).toBe('');
  });

  it('formats initials and region-aware locations', () => {
    expect(getInitials('Louis Do')).toBe('LD');
    expect(getInitials('   ')).toBe('AT');
    expect(formatCategoryLabel('nightlife')).toBe('Nightlife');
    expect(formatCategoryLabel('')).toBe('');
    expect(formatCategoryLabel(undefined)).toBe('');
    expect(formatCountryLabel('us')).toBe('USA');
    expect(formatCountryLabel('prt')).toBe('PRT');
    expect(formatCountryLabel('Portugal')).toBe('Portugal');
    expect(formatCountryLabel(undefined)).toBe('');
    expect(resolveLocationRegion({ city: 'Chicago' })).toBe('IL');
    expect(resolveLocationRegion({ adminArea: 'British Columbia' })).toBe('British Columbia');
    expect(resolveLocationRegion({ stateCode: 'US-TX' })).toBe('TX');
    expect(resolveLocationRegion({ city: 'Lisbon', country: 'Portugal' })).toBe('Lisbon');
    expect(resolveLocationRegion({ country: 'Canada' })).toBe('');
    expect(resolveLocationRegion({ country: 'Canada' }, { allowCountryFallback: true })).toBe('Canada');
    expect(formatCityRegionLocation({ city: 'Dallas', country: 'US' })).toBe('Dallas, TX');
    expect(formatCityRegionLocation({ city: 'Porto' })).toBe('Porto');
    expect(formatCityRegionLocation({ city: 'Porto', country: 'Portugal' })).toBe('Porto, Portugal');
    expect(resolveCityRegionLocation({
      title: 'Pearl District Market Hall',
      city: 'San Antonio',
    })).toMatchObject({
      city: 'San Antonio',
      region: 'TX',
      country: 'USA',
      label: 'San Antonio, TX',
    });
    expect(resolveCityRegionLocation({
      title: 'Pearl District Market Hall',
      city: 'Pearl',
      country: 'US',
    })).toMatchObject({
      city: 'Pearl',
      region: 'USA',
      country: 'USA',
      label: 'Pearl, USA',
    });
    expect(resolveCityRegionLocation({
      city: 'Toronto',
      stateCode: 'ON',
      country: 'Canada',
    })).toMatchObject({
      city: 'Toronto',
      region: 'ON',
      country: 'Canada',
      label: 'Toronto, ON',
    });
    expect(formatCityRegionLocation({
      id: '90000000-0000-0000-0000-000000000002',
      title: 'San Antonio River Walk Blue Hour',
    })).toBe('San Antonio, TX');
    expect(resolveCityRegionLocation({
      id: '90000000-0000-0000-0000-000000000024',
      title: 'Sydney Opera House Circular Quay',
    })).toMatchObject({
      city: 'Sydney',
      region: 'NSW',
      label: 'Sydney, NSW',
    });
    expect(formatCityRegionLocation({ country: 'mx' })).toBe('MX');
    expect(formatCityRegionLocation({}, 'Unknown pin')).toBe('Unknown pin');
    expect(formatHomeBaseLocation({
      address: '7620 Deaver Drive',
      city: 'North Richland Hills',
      stateCode: 'us-tx',
      country: 'United States',
      precision: 'address',
    })).toBe('7620 Deaver Drive, North Richland Hills, TX');
    expect(formatHomeBaseLocation({
      address: '7620',
      placeName: 'Deaver Drive',
      city: 'North Richland Hills',
      stateCode: 'us-tx',
      country: 'United States',
      precision: 'address',
    })).toBe('7620 Deaver Drive, North Richland Hills, TX');
    expect(formatHomeBaseLocation({
      placeName: 'Downtown Dallas',
      city: 'Dallas',
      stateCode: 'TX',
      country: 'US',
      precision: 'neighborhood',
    })).toBe('Downtown Dallas, Dallas, TX');
    expect(formatHomeBaseLocation({
      formattedAddress: 'Fallback formatted',
      placeName: 'Fallback place',
      address: 'Fallback address',
      precision: 'city',
    })).toBe('Fallback formatted');
    expect(formatHomeBaseLocation({
      placeName: 'Fallback place',
      address: 'Fallback address',
      precision: 'city',
    })).toBe('Fallback place');
    expect(formatHomeBaseLocation({
      address: 'Fallback address',
      precision: 'city',
    })).toBe('Fallback address');
    expect(formatHomeBaseLocation({
      address: '500 Main Street',
      precision: 'address',
    })).toBe('500 Main Street');
    expect(formatHomeBaseLocation({
      formattedAddress: '',
      placeName: '',
      address: 'Only address fallback',
      precision: 'city',
    })).toBe('Only address fallback');
    expect(formatCityRegionLocation({ city: 'Remote Island', country: 'mx' })).toBe('Remote Island, MX');
  });
});
