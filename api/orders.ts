import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOrders, setOrders } from './lib/kv';
import {
  validateDate,
  validateNickname,
  normalizeNickname,
  isCutoffPassed,
} from './lib/validation';
import { VALID_MAINS, VALID_SECONDARIES } from '../src/types';
import type { SubmitOrderRequest, MenuOption } from '../src/types';

const MAX_FIELD = 200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── GET /api/orders?date=YYYY-MM-DD ────────────────────────────────────────
  if (req.method === 'GET') {
    const date = req.query.date as string | undefined;
    if (!date) return res.status(400).json({ error: 'Missing required query param: date' });

    const dateError = validateDate(date);
    if (dateError) return res.status(400).json({ error: dateError });

    const orders = await getOrders(date);
    return res.status(200).json(orders);
  }

  // ── POST /api/orders ───────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const date = req.query.date as string | undefined;
    if (!date) return res.status(400).json({ error: 'Missing required query param: date' });

    const dateError = validateDate(date);
    if (dateError) return res.status(400).json({ error: dateError });

    if (isCutoffPassed(date)) {
      return res.status(403).json({ error: 'Ordering is closed for this date (cutoff passed)' });
    }

    const body = req.body as Partial<SubmitOrderRequest>;
    const { nickname: rawNickname, main, secondary, quantity: rawQuantity, note: rawNote } = body ?? {};

    const nicknameError = validateNickname(rawNickname ?? '');
    if (nicknameError) return res.status(400).json({ error: nicknameError });

    if (typeof main !== 'string' || main.trim().length === 0) {
      return res.status(400).json({ error: 'main is required' });
    }
    if (main.length > MAX_FIELD) {
      return res.status(400).json({ error: `main must be at most ${MAX_FIELD} characters` });
    }
    if (typeof secondary !== 'string' || secondary.trim().length === 0) {
      return res.status(400).json({ error: 'secondary is required' });
    }
    if (secondary.length > MAX_FIELD) {
      return res.status(400).json({ error: `secondary must be at most ${MAX_FIELD} characters` });
    }

    if (!(VALID_MAINS as readonly string[]).includes(main)) {
      return res.status(400).json({ error: 'main must be one of the available menu options' });
    }
    if (!(VALID_SECONDARIES as readonly string[]).includes(secondary)) {
      return res.status(400).json({ error: 'secondary must be one of the available menu options' });
    }

    const quantity = rawQuantity == null ? 1 : Number(rawQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return res.status(400).json({ error: 'quantity must be an integer between 1 and 10' });
    }

    const MAX_NOTE = 100;
    if (rawNote !== undefined && rawNote !== null) {
      if (typeof rawNote !== 'string') {
        return res.status(400).json({ error: 'note must be a string' });
      }
      if (rawNote.length > MAX_NOTE) {
        return res.status(400).json({ error: `note must be at most ${MAX_NOTE} characters` });
      }
    }
    const note = typeof rawNote === 'string' ? rawNote.trim() : undefined;

    const nickname = normalizeNickname(rawNickname!);
    const dailyOrders = await getOrders(date);

    // Always append a new order entry (one nickname can have multiple orders)
    const id = crypto.randomUUID();
    const order = { id, nickname, main: main as MenuOption, secondary: secondary as MenuOption, quantity, ...(note ? { note } : {}) };
    dailyOrders.orders.push(order);

    await setOrders(date, dailyOrders);
    return res.status(200).json(dailyOrders);
  }

  // ── DELETE /api/orders ─────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    // Accept date from query or body
    const date = (req.query.date as string | undefined) ?? (req.body as Record<string, string>)?.date;
    if (!date) return res.status(400).json({ error: 'Missing required param: date' });

    const dateError = validateDate(date);
    if (dateError) return res.status(400).json({ error: dateError });

    if (isCutoffPassed(date)) {
      return res.status(403).json({ error: 'Ordering is closed for this date (cutoff passed)' });
    }

    const rawId = (req.body as Record<string, string>)?.id ?? (req.query.id as string | undefined);
    if (!rawId || typeof rawId !== 'string' || rawId.trim().length === 0) {
      return res.status(400).json({ error: 'Missing required param: id' });
    }

    const dailyOrders = await getOrders(date);
    const before = dailyOrders.orders.length;
    dailyOrders.orders = dailyOrders.orders.filter((o) => o.id !== rawId);
    if (dailyOrders.orders.length === before) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await setOrders(date, dailyOrders);
    return res.status(200).json(dailyOrders);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
