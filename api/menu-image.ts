import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMenuImage } from './lib/kv';
import { validateDate } from './lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const date = typeof req.query.date === 'string' ? req.query.date : '';
  if (!date) {
    return res.status(400).json({ error: 'Missing required query param: date' });
  }

  const dateError = validateDate(date);
  if (dateError) {
    return res.status(400).json({ error: dateError });
  }

  const dataUrl = await getMenuImage(date);
  if (!dataUrl) {
    return res.status(404).json({ error: 'No menu image for this date' });
  }

  return res.status(200).json({ dataUrl });
}
