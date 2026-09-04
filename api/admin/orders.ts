import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminSession } from '../lib/auth';
import { getOrders } from '../lib/kv';
import { validateDate } from '../lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyAdminSession(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const date = typeof req.query.date === 'string' ? req.query.date : '';
  const dateError = validateDate(date);
  if (dateError) {
    return res.status(400).json({ error: dateError });
  }

  const orders = await getOrders(date);
  return res.status(200).json(orders);
}
