import { describe, expect, it } from 'vitest';
import { ordersKey, menuImageKey } from './storage-keys';

describe('storage keys', () => {
  it('builds an orders key', () => {
    expect(ordersKey('2025-07-14')).toBe('orders:2025-07-14');
  });

  it('builds a menu-image key', () => {
    expect(menuImageKey('2025-07-14')).toBe('menu-image:2025-07-14');
  });
});
