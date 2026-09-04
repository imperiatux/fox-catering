import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminSession } from '../lib/auth';
import { getMenu, setMenu } from '../lib/kv';
import { validateDate, validateMenuVariant } from '../lib/validation';
import type { AdminMenuRequest } from '../../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyAdminSession(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const date = typeof req.query.date === 'string' ? req.query.date : '';
  const dateError = validateDate(date);
  if (dateError) {
    return res.status(400).json({ error: dateError });
  }

  if (req.method === 'GET') {
    const menu = await getMenu(date);
    if (!menu) {
      return res.status(200).json({ date, vegetarian: null, nonVegetarian: null });
    }
    return res.status(200).json(menu);
  }

  if (req.method === 'PUT') {
    const body: AdminMenuRequest = req.body ?? {};

    const vegError = validateMenuVariant(body.vegetarian);
    if (vegError) return res.status(400).json({ error: `vegetarian: ${vegError}` });

    const nonVegError = validateMenuVariant(body.nonVegetarian);
    if (nonVegError) return res.status(400).json({ error: `nonVegetarian: ${nonVegError}` });

    const menu = {
      date,
      vegetarian: body.vegetarian,
      nonVegetarian: body.nonVegetarian,
    };

    await setMenu(date, menu);
    return res.status(200).json(menu);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
