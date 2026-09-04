import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMenu, getOrders, setOrders } from './lib/kv';
import {
  validateDate,
  validateNickname,
  normalizeNickname,
  isCutoffPassed,
} from './lib/validation';
import type { SubmitOrderRequest } from '../src/types';

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
    const { nickname: rawNickname, main, secondary } = body ?? {};

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

    // Validate main/secondary exist in the menu
    const menu = await getMenu(date);
    if (!menu) {
      return res.status(404).json({ error: 'No menu for this date' });
    }
    const validMains = [menu.vegetarian.main, menu.nonVegetarian.main];
    const validSecondaries = [menu.vegetarian.secondary, menu.nonVegetarian.secondary];
    if (!validMains.includes(main)) {
      return res.status(400).json({ error: 'main must be one of the available menu options' });
    }
    if (!validSecondaries.includes(secondary)) {
      return res.status(400).json({ error: 'secondary must be one of the available menu options' });
    }

    const nickname = normalizeNickname(rawNickname!);
    const dailyOrders = await getOrders(date);

    // Replace existing order for same nickname, or append
    const idx = dailyOrders.orders.findIndex((o) => o.nickname === nickname);
    const order = { nickname, main, secondary };
    if (idx >= 0) {
      dailyOrders.orders[idx] = order;
    } else {
      dailyOrders.orders.push(order);
    }

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

    const rawNickname =
      (req.body as Record<string, string>)?.nickname ?? (req.query.nickname as string | undefined);
    const nicknameError = validateNickname(rawNickname ?? '');
    if (nicknameError) return res.status(400).json({ error: nicknameError });

    const nickname = normalizeNickname(rawNickname!);
    const dailyOrders = await getOrders(date);
    dailyOrders.orders = dailyOrders.orders.filter((o) => o.nickname !== nickname);

    await setOrders(date, dailyOrders);
    return res.status(200).json(dailyOrders);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
