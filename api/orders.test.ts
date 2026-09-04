import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './orders';
import { getMenu, getOrders, setOrders } from './lib/kv';
import { isCutoffPassed } from './lib/validation';

vi.mock('./lib/kv', () => ({
  getMenu: vi.fn(),
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

const menu = {
  date: '2025-07-14',
  vegetarian: { main: 'Veg main', secondary: 'Veg side' },
  nonVegetarian: { main: 'Meat main', secondary: 'Meat side' },
};

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
      nickname: '', main: 'Veg main', secondary: 'Veg side',
    }), res);

    expect(res.statusCode).toBe(400);
  });

  it('stores valid POST data and returns updated orders', async () => {
    vi.mocked(getMenu).mockResolvedValue(menu);
    vi.mocked(getOrders).mockResolvedValue({ date: '2025-07-14', orders: [] });
    const res = mockRes();

    await handler(mockReq('POST', { date: '2025-07-14' }, {
      nickname: ' Fox ', main: 'Veg main', secondary: 'Veg side',
    }), res);

    const expected = {
      date: '2025-07-14',
      orders: [{ nickname: 'fox', main: 'Veg main', secondary: 'Veg side' }],
    };
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(expected);
    expect(setOrders).toHaveBeenCalledWith('2025-07-14', expected);
  });

  it('rejects DELETE after the cutoff', async () => {
    vi.mocked(isCutoffPassed).mockReturnValue(true);
    const res = mockRes();

    await handler(mockReq('DELETE', { date: '2025-07-14' }, { nickname: 'Fox' }), res);

    expect(res.statusCode).toBe(403);
  });

  it('removes an order for a valid DELETE', async () => {
    vi.mocked(getOrders).mockResolvedValue({
      date: '2025-07-14',
      orders: [
        { nickname: 'fox', main: 'Veg main', secondary: 'Veg side' },
        { nickname: 'wolf', main: 'Meat main', secondary: 'Meat side' },
      ],
    });
    const res = mockRes();

    await handler(mockReq('DELETE', { date: '2025-07-14' }, { nickname: ' Fox ' }), res);

    const expected = {
      date: '2025-07-14',
      orders: [{ nickname: 'wolf', main: 'Meat main', secondary: 'Meat side' }],
    };
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(expected);
    expect(setOrders).toHaveBeenCalledWith('2025-07-14', expected);
  });
});
