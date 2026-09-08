/**
 * Redis data layer for Fox Catering.
 *
 * Key schema:
 *   menu:YYYY-MM-DD        String  — filename of the uploaded menu photo
 *   orders:YYYY-MM-DD      List    — JSON-serialised Order objects (rpush / lrange)
 *   tips:YYYY-MM-DD        Hash    — nickname → tip amount (RON, string-encoded float)
 *   settings               Hash    — cutoffHour, cutoffMinute, cutoffEnabled, activeDays,
 *                                    whatsappPhone, priceNonVeg, priceVeg, priceSoup, priceMain, priceCustom
 *   session:<token>        String  — "admin" with 8 h TTL
 */

import Redis from 'ioredis';
import type { Order, AppSettings } from '@/types';

// ---------------------------------------------------------------------------
// Date helper — always use the server-local date (TZ env var = Europe/Bucharest)
// so that "today" matches the admin-configured timezone, not UTC.
// ---------------------------------------------------------------------------

/**
 * Returns the current local date as "YYYY-MM-DD" using the server's TZ
 * environment variable (set to Europe/Bucharest in docker-compose.yml).
 * Avoids the UTC-midnight bug where toISOString() returns yesterday's date
 * at e.g. 00:10 EEST (= 21:10 UTC the previous day).
 */
export function localDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.TZ ?? 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // en-CA locale formats as YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

const globalForRedis = global as unknown as { redis?: Redis };

function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    // Don't connect until the first command is issued.
    lazyConnect: true,
    // Cap reconnect delay at 3 s; retry indefinitely so the app recovers
    // automatically if Redis restarts.
    retryStrategy: (times: number) => Math.min(times * 100, 3000),
    // null = wait indefinitely for a command to succeed once connected.
    // The default (20) causes errors when the first request arrives before
    // the connection is fully established.
    maxRetriesPerRequest: null,
  });

  // Suppress unhandled error events (e.g. ECONNREFUSED noise in logs).
  client.on('error', () => {});

  return client;
}

export const redis: Redis =
  globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: AppSettings = {
  cutoffHour: 10,
  cutoffMinute: 30,
  cutoffEnabled: true,
  activeDays: [1, 2, 3, 4, 5, 6, 7],
  whatsappPhone: '',
  priceNonVeg: 0,
  priceVeg: 0,
  priceSoupNonVeg: 0,
  priceSoupVeg: 0,
  priceMainNonVeg: 0,
  priceMainVeg: 0,
  priceCustom: 0,
};

// ---------------------------------------------------------------------------
// Order functions
// Key: orders:YYYY-MM-DD (Redis LIST of JSON strings)
// ---------------------------------------------------------------------------

/** Returns all orders for the given date. Returns [] when the key is missing. */
export async function getOrders(date: string): Promise<Order[]> {
  const raw = await redis.lrange(`orders:${date}`, 0, -1);
  return raw.map((s) => JSON.parse(s) as Order);
}

/** Appends a new order to the list for the given date. */
export async function addOrder(date: string, order: Order): Promise<void> {
  await redis.rpush(`orders:${date}`, JSON.stringify(order));
}

/** Removes an order by id from the list for the given date. */
export async function deleteOrder(date: string, id: string): Promise<void> {
  const orders = await getOrders(date);
  const key = `orders:${date}`;

  // Remove all existing entries, then re-push without the deleted one.
  await redis.del(key);
  const remaining = orders.filter((o) => o.id !== id);
  if (remaining.length > 0) {
    await redis.rpush(key, ...remaining.map((o) => JSON.stringify(o)));
  }
}

/** Applies a partial update to an existing order. No-op if the order is not found. */
export async function updateOrder(
  date: string,
  id: string,
  patch: Partial<Omit<Order, 'id' | 'createdAt'>>,
): Promise<Order | null> {
  const orders = await getOrders(date);
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;

  const updated: Order = { ...orders[idx], ...patch };
  orders[idx] = updated;

  const key = `orders:${date}`;
  await redis.del(key);
  await redis.rpush(key, ...orders.map((o) => JSON.stringify(o)));

  return updated;
}

// ---------------------------------------------------------------------------
// Menu photo functions
// Key: menu:YYYY-MM-DD (Redis STRING — filename)
// ---------------------------------------------------------------------------

/** Returns the menu photo filename for the given date, or null if none. */
export async function getMenuPhoto(date: string): Promise<string | null> {
  return redis.get(`menu:${date}`);
}

/** Sets the menu photo filename for the given date. */
export async function setMenuPhoto(date: string, filename: string): Promise<void> {
  await redis.set(`menu:${date}`, filename);
}

/** Deletes the menu photo record for the given date. */
export async function deleteMenuPhoto(date: string): Promise<void> {
  await redis.del(`menu:${date}`);
}

// ---------------------------------------------------------------------------
// Tip functions
// Key: tips:YYYY-MM-DD (Redis HASH — nickname → RON amount as string)
// One entry per nickname per day; independent of the orders list.
// ---------------------------------------------------------------------------

/** Returns the tip for the given nickname today, or null if not set. */
export async function getTip(date: string, nickname: string): Promise<number | null> {
  const raw = await redis.hget(`tips:${date}`, nickname);
  if (raw === null) return null;
  return Number(raw);
}

/** Sets (or overwrites) the tip for the given nickname today. */
export async function setTip(date: string, nickname: string, tip: number): Promise<void> {
  await redis.hset(`tips:${date}`, nickname, String(tip));
}

/** Returns the sum of all tips for a given date. */
export async function getTipsTotal(date: string): Promise<number> {
  const all = await redis.hgetall(`tips:${date}`);
  if (!all) return 0;
  return Object.values(all).reduce((sum, v) => sum + Number(v), 0);
}

/** Returns all tips for a given date as a nickname → amount map. */
export async function getAllTips(date: string): Promise<Record<string, number>> {
  const all = await redis.hgetall(`tips:${date}`);
  if (!all) return {};
  return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, Number(v)]));
}

// ---------------------------------------------------------------------------
// Settings functions
// Key: settings (Redis HASH)
// Fields: cutoffHour, cutoffMinute, cutoffEnabled, activeDays, whatsappPhone
// ---------------------------------------------------------------------------

/**
 * Returns the application settings. If the key does not exist in Redis the
 * default settings are seeded into the hash and returned.
 */
export async function getSettings(): Promise<AppSettings> {
  const raw = await redis.hgetall('settings');

  // Seed defaults on first access.
  if (!raw || Object.keys(raw).length === 0) {
    await seedDefaultSettings();
    return { ...DEFAULT_SETTINGS };
  }

  return {
    cutoffHour: Number(raw.cutoffHour),
    cutoffMinute: Number(raw.cutoffMinute),
    cutoffEnabled: raw.cutoffEnabled === 'true',
    activeDays: JSON.parse(raw.activeDays) as number[],
    whatsappPhone: raw.whatsappPhone ?? '',
    priceNonVeg: Number(raw.priceNonVeg ?? 0),
    priceVeg: Number(raw.priceVeg ?? 0),
    priceSoupNonVeg: Number(raw.priceSoupNonVeg ?? raw.priceSoup ?? 0),
    priceSoupVeg: Number(raw.priceSoupVeg ?? raw.priceSoup ?? 0),
    priceMainNonVeg: Number(raw.priceMainNonVeg ?? raw.priceMain ?? 0),
    priceMainVeg: Number(raw.priceMainVeg ?? raw.priceMain ?? 0),
    priceCustom: Number(raw.priceCustom ?? 0),
  };
}

/**
 * Merges the provided patch into the settings hash and returns the full
 * updated settings.
 */
export async function setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = { ...current, ...patch };

  await redis.hset('settings', {
    cutoffHour: String(next.cutoffHour),
    cutoffMinute: String(next.cutoffMinute),
    cutoffEnabled: String(next.cutoffEnabled),
    activeDays: JSON.stringify(next.activeDays),
    whatsappPhone: next.whatsappPhone ?? '',
    priceNonVeg: String(next.priceNonVeg ?? 0),
    priceVeg: String(next.priceVeg ?? 0),
    priceSoupNonVeg: String(next.priceSoupNonVeg ?? 0),
    priceSoupVeg: String(next.priceSoupVeg ?? 0),
    priceMainNonVeg: String(next.priceMainNonVeg ?? 0),
    priceMainVeg: String(next.priceMainVeg ?? 0),
    priceCustom: String(next.priceCustom ?? 0),
  });

  return next;
}

async function seedDefaultSettings(): Promise<void> {
  await redis.hset('settings', {
    cutoffHour: String(DEFAULT_SETTINGS.cutoffHour),
    cutoffMinute: String(DEFAULT_SETTINGS.cutoffMinute),
    cutoffEnabled: String(DEFAULT_SETTINGS.cutoffEnabled),
    activeDays: JSON.stringify(DEFAULT_SETTINGS.activeDays),
    whatsappPhone: DEFAULT_SETTINGS.whatsappPhone,
    priceNonVeg: String(DEFAULT_SETTINGS.priceNonVeg),
    priceVeg: String(DEFAULT_SETTINGS.priceVeg),
    priceSoupNonVeg: String(DEFAULT_SETTINGS.priceSoupNonVeg),
    priceSoupVeg: String(DEFAULT_SETTINGS.priceSoupVeg),
    priceMainNonVeg: String(DEFAULT_SETTINGS.priceMainNonVeg),
    priceMainVeg: String(DEFAULT_SETTINGS.priceMainVeg),
    priceCustom: String(DEFAULT_SETTINGS.priceCustom),
  });
}

// ---------------------------------------------------------------------------
// Session functions
// Key: session:<token> (Redis STRING — "admin", TTL 8 h)
// ---------------------------------------------------------------------------

const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

/** Stores an admin session token in Redis with an 8-hour TTL. */
export async function setSession(token: string): Promise<void> {
  await redis.set(`session:${token}`, 'admin', 'EX', SESSION_TTL_SECONDS);
}

/**
 * Returns the session value for the given token, or null if the session
 * does not exist or has expired.
 */
export async function getSession(token: string): Promise<string | null> {
  return redis.get(`session:${token}`);
}

/** Deletes the session for the given token. */
export async function deleteSession(token: string): Promise<void> {
  await redis.del(`session:${token}`);
}
