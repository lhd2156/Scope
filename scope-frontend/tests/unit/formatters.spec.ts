import { describe, expect, it } from 'vitest';
import { formatMapPinCityLine, formatVibeLabel } from '@/utils/formatters';

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
