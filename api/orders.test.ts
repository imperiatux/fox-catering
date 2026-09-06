import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './orders';
import { getOrders, setOrders } from './lib/kv';
import { isCutoffPassed } from './lib/validation';
import { MENU_OPTIONS } from '../src/types';

vi.mock('./lib/kv', () => ({
  getOrders: vi.fn(),
  setOrders: vi.fn(),
}));

vi.mock('./lib/validation', async () => {
  const actual = await vi.importActual<typeof import('./lib/validation')>('./lib/validation');
  return { ...actual, isCutoffPassed: vi.fn() };
});

function mockReq(method: string, query: Record<string, string>, body: unknown, cookie = '') {
  return { method, query, body, headers: { cookie } } as any;
}

function mockRes() {
  const res: any = { statusCode: 200, headers: {}, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.body = data; return res; };
  res.setHeader = (key: string, value: string) => { res.headers[key] = value; return res; };
  res.end = () => res;
  return res as any;
}

describe('orders API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isCutoffPassed).mockReturnValue(false);
  });

  it('rejects POST after the cutoff', async () => {
    vi.mocked(isCutoffPassed).mockReturnValue(true);
    const res = mockRes();

    await handler(mockReq('POST', { date: '2025-07-14' }, {}), res);

    expect(res.statusCode).toBe(403);
  });

  it('rejects POST with an invalid nickname', async () => {
    const res = mockRes();

    await handler(mockReq('POST', { date: '2025-07-14' }, {
      nickname: '', main: MENU_OPTIONS.vegMain, secondary: MENU_OPTIONS.vegSoup,
    }), res);

    expect(res.statusCode).toBe(400);
  });

  it('stores valid POST data and returns updated orders', async () => {
    vi.mocked(getOrders).mockResolvedValue({ date: '2025-07-14', orders: [] });
    const res = mockRes();

    await handler(mockReq('POST', { date: '2025-07-14' }, {
      nickname: ' Fox ', main: MENU_OPTIONS.vegMain, secondary: MENU_OPTIONS.vegSoup,
    }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0]).toMatchObject({
      nickname: 'Fox', main: MENU_OPTIONS.vegMain, secondary: MENU_OPTIONS.vegSoup, quantity: 1,
    });
    expect(typeof res.body.orders[0].id).toBe('string');
    expect(res.body.orders[0].id.length).toBeGreaterThan(0);
  });

  it('rejects DELETE after the cutoff', async () => {
    vi.mocked(isCutoffPassed).mockReturnValue(true);
    const res = mockRes();

    await handler(mockReq('DELETE', { date: '2025-07-14' }, { id: 'some-id' }), res);

    expect(res.statusCode).toBe(403);
  });

  it('removes an order for a valid DELETE', async () => {
    vi.mocked(getOrders).mockResolvedValue({
      date: '2025-07-14',
      orders: [
        { id: 'id-fox',  nickname: 'Fox',  main: MENU_OPTIONS.vegMain,    secondary: MENU_OPTIONS.vegSoup,    quantity: 1 },
        { id: 'id-wolf', nickname: 'wolf', main: MENU_OPTIONS.nonVegMain, secondary: MENU_OPTIONS.nonVegSoup, quantity: 1 },
      ],
    });
    const res = mockRes();

    await handler(mockReq('DELETE', { date: '2025-07-14' }, { id: 'id-fox' }), res);

    const expected = {
      date: '2025-07-14',
      orders: [{ id: 'id-wolf', nickname: 'wolf', main: MENU_OPTIONS.nonVegMain, secondary: MENU_OPTIONS.nonVegSoup, quantity: 1 }],
    };
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(expected);
    expect(setOrders).toHaveBeenCalledWith('2025-07-14', expected);
  });
});
