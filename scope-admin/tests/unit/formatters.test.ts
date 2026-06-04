import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatLocation,
  formatNumber,
  formatPercent,
  truncateText,
} from '@/utils/formatters';

describe('formatters', () => {
  it('formats dates', () => {
    expect(formatDate('2026-04-27T12:00:00Z')).toContain('2026');
  });

  it('handles invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('Not available');
    expect(formatDate()).toBe('Not available');
    expect(formatDateTime()).toBe('Not available');
    expect(formatDateTime('not-a-date')).toBe('Not available');
  });

  it('formats date and time', () => {
    expect(formatDateTime('2026-04-27T12:30:00Z')).toContain('2026');
  });

  it('formats numbers', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formats locations from city, country, location, and fallback parts', () => {
    expect(formatLocation({ city: 'Dallas', country: 'US', location: 'Texas' })).toBe('Dallas, US');
    expect(formatLocation({ city: '  Paris  ', country: '' })).toBe('Paris');
    expect(formatLocation({ location: 'Remote review queue' })).toBe('Remote review queue');
    expect(formatLocation({}, 'Not provided')).toBe('Not provided');
  });

  it('formats percentages and truncates text', () => {
    expect(formatPercent(0.428)).toBe('42.8%');
    expect(formatPercent()).toBe('0%');
    expect(truncateText('Scope admin moderation queue', 12)).toBe('Scope admin...');
    expect(truncateText('Short copy', 20)).toBe('Short copy');
    expect(truncateText('Long copy', 0)).toBe('...');
  });
});
