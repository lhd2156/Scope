import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  formatCategoryLabel,
  formatCityRegionLocation,
  formatCountryLabel,
  formatMapPinCityLine,
  formatMonthDay,
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
    expect(formatRelativeTime('not-a-date', '2026-05-20T12:00:00Z')).toBe('');
    expect(formatMonthDay('2026-05-20')).toContain('May');
    expect(formatMonthDay('not-a-date')).toBe('');
    expect(formatWeekdayMonthDay('2026-05-20')).toContain('May');
    expect(getInclusiveDaySpan('2026-05-20', '2026-05-22')).toBe(3);
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
    expect(resolveLocationRegion({ city: 'Lisbon', country: 'Portugal' })).toBe('Lisbon');
    expect(resolveLocationRegion({ country: 'Canada' }, { allowCountryFallback: true })).toBe('Canada');
    expect(formatCityRegionLocation({ city: 'Dallas', country: 'US' })).toBe('Dallas, TX');
    expect(formatCityRegionLocation({ city: 'Porto', country: 'Portugal' })).toBe('Porto, Portugal');
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
  });
});
