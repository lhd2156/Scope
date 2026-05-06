import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatNumber, formatPercent, truncateText } from '@/utils/formatters';

describe('formatters', () => {
  it('formats dates', () => {
    expect(formatDate('2026-04-27T12:00:00Z')).toContain('2026');
  });

  it('handles invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('Not available');
  });

  it('formats date and time', () => {
    expect(formatDateTime('2026-04-27T12:30:00Z')).toContain('2026');
  });

  it('formats numbers', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formats percentages and truncates text', () => {
    expect(formatPercent(0.428)).toBe('42.8%');
    expect(truncateText('Scope admin moderation queue', 12)).toBe('Scope admin...');
  });
});
