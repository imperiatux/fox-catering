import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isCutoffPassed,
  normalizeNickname,
  validateDate,
  validateMenuVariant,
  validateNickname,
} from './validation';

describe('server validation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes nicknames', () => {
    expect(normalizeNickname('  Fox User  ')).toBe('fox user');
    expect(normalizeNickname('A'.repeat(41))).toBe('a'.repeat(40));
  });

  it('validates nicknames', () => {
    expect(validateNickname('Fox')).toBeNull();
    expect(validateNickname('   ')).not.toBeNull();
    expect(validateNickname('a'.repeat(41))).not.toBeNull();
  });

  it('validates dates', () => {
    expect(validateDate('2025-07-14')).toBeNull();
    expect(validateDate('not-a-date')).not.toBeNull();
    expect(validateDate('2025-13-01')).not.toBeNull();
  });

  it('validates menu variants', () => {
    expect(validateMenuVariant({ main: 'A', secondary: 'B' })).toBeNull();
    expect(validateMenuVariant({ main: '', secondary: 'B' })).not.toBeNull();
    expect(validateMenuVariant({ main: 'A' })).not.toBeNull();
    expect(validateMenuVariant({ main: 'a'.repeat(201), secondary: 'B' })).not.toBeNull();
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
});
