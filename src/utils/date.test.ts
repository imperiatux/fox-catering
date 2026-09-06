import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateDisplay, isCutoffPassed, isWeekend } from './date';

describe('date utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isWeekend', () => {
    it('identifies Saturday and Sunday as weekends', () => {
      expect(isWeekend('2025-07-12')).toBe(true);
      expect(isWeekend('2025-07-13')).toBe(true);
    });

    it('identifies a weekday', () => {
      expect(isWeekend('2025-07-14')).toBe(false);
    });
  });

  describe('isCutoffPassed', () => {
    it.each([
      ['2025-07-14T07:29:00Z', false],
      ['2025-07-14T07:30:00Z', true],
      ['2025-07-14T07:31:00Z', true],
    ])('at %s returns %s', (time, expected) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(time));

      expect(isCutoffPassed('2025-07-14')).toBe(expected);
    });
  });

  describe('formatDateDisplay', () => {
    it('formats a date with weekday, month, and year', () => {
      const formatted = formatDateDisplay('2025-07-14');

      expect(formatted).toContain('Monday');
      expect(formatted).toContain('July');
      expect(formatted).toContain('2025');
    });
  });
});
