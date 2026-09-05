import type { DailyOrders } from '../../src/types';
import { ordersKey, menuImageKey, SETTINGS_KEY } from './storage-keys';

const TTL_SECONDS = 259200; // 3 days

// ---------------------------------------------------------------------------
// Backend selection
// When REDIS_URL is set (local Docker), use ioredis directly.
// Otherwise fall back to @vercel/kv (Upstash REST API on Vercel).
// ---------------------------------------------------------------------------

type KvBackend = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl: number): Promise<void>;
  setPersist(key: string, value: unknown): Promise<void>;
};

function makeVercelKvBackend(): KvBackend {
  // Lazy import so that @vercel/kv is only resolved when actually used
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { kv } = require('@vercel/kv') as { kv: import('@vercel/kv').VercelKV };
  return {
    get: (key) => kv.get(key),
    set: (key, value, ttl) => kv.set(key, value, { ex: ttl }).then(() => undefined),
    setPersist: (key, value) => kv.set(key, value).then(() => undefined),
  };
}

function makeRedisBackend(url: string): KvBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Redis = require('ioredis') as typeof import('ioredis').default;
  const client = new Redis(url);
  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await client.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    },
    async set(key: string, value: unknown, ttl: number): Promise<void> {
      await client.set(key, JSON.stringify(value), 'EX', ttl);
    },
    async setPersist(key: string, value: unknown): Promise<void> {
      await client.set(key, JSON.stringify(value));
    },
  };
}

let _backend: KvBackend | null = null;

function getBackend(): KvBackend {
  if (_backend) return _backend;
  const redisUrl = process.env.REDIS_URL;
  _backend = redisUrl ? makeRedisBackend(redisUrl) : makeVercelKvBackend();
  return _backend;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export async function getOrders(date: string): Promise<DailyOrders> {
  const stored = await getBackend().get<DailyOrders>(ordersKey(date));
  return stored ?? { date, orders: [] };
}

export async function setOrders(date: string, orders: DailyOrders): Promise<void> {
  await getBackend().set(ordersKey(date), orders, TTL_SECONDS);
}

export async function getMenuImage(date: string): Promise<string | null> {
  return getBackend().get<string>(menuImageKey(date));
}

export async function setMenuImage(date: string, dataUrl: string): Promise<void> {
  await getBackend().set(menuImageKey(date), dataUrl, TTL_SECONDS);
}

export interface AdminSettings {
  whatsappNumber?: string;
}

export async function getSettings(): Promise<AdminSettings> {
  return (await getBackend().get<AdminSettings>(SETTINGS_KEY)) ?? {};
}

export async function setSettings(settings: AdminSettings): Promise<void> {
  await getBackend().setPersist(SETTINGS_KEY, settings);
}
