import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminSession } from '../lib/auth';
import { getSettings, setSettings } from '../lib/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyAdminSession(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── GET /api/admin/settings ───────────────────────────────────────────────
  if (req.method === 'GET') {
    const settings = await getSettings();
    return res.status(200).json(settings);
  }

  // ── POST /api/admin/settings ──────────────────────────────────────────────
  if (req.method === 'POST') {
    const { whatsappNumber } = (req.body ?? {}) as { whatsappNumber?: unknown };

    if (whatsappNumber !== undefined) {
      if (typeof whatsappNumber !== 'string') {
        return res.status(400).json({ error: 'whatsappNumber must be a string' });
      }
      const clean = whatsappNumber.replace(/\D/g, '');
      if (clean.length > 0 && (clean.length < 7 || clean.length > 15)) {
        return res.status(400).json({ error: 'whatsappNumber must be 7–15 digits' });
      }
      const current = await getSettings();
      await setSettings({ ...current, whatsappNumber: clean || undefined });
      const updated = await getSettings();
      return res.status(200).json(updated);
    }

    return res.status(400).json({ error: 'No recognised settings field in request body' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
