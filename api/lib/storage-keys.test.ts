import { describe, expect, it } from 'vitest';
import { menuKey, ordersKey } from './storage-keys';

describe('storage keys', () => {
  it('builds a menu key', () => {
    expect(menuKey('2025-07-14')).toBe('menu:2025-07-14');
  });

  it('builds an orders key', () => {
    expect(ordersKey('2025-07-14')).toBe('orders:2025-07-14');
  });
});
