import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminSession } from '../lib/auth';
import { getOrders } from '../lib/kv';
import { validateDate } from '../lib/validation';

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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

  const { orders } = await getOrders(date);

  const rows = [
    'nickname,quantity,soup_course,main_course,note',
    ...orders.map(
      (o) => `${csvEscape(o.nickname)},${o.quantity ?? 1},${csvEscape(o.secondary)},${csvEscape(o.main)},${csvEscape(o.note ?? '')}`
    ),
  ];
  const csv = rows.join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${date}.csv"`);
  return res.status(200).send(csv);
}
