import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCutoff } from './lib/validation';

/**
 * GET /api/config
 * Returns public runtime configuration — cutoff time and whether it is enabled.
 * No secrets are exposed.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const { hour, minute, cutoffEnabled } = getCutoff();
  return res.status(200).json({ cutoffHour: hour, cutoffMinute: minute, cutoffEnabled });
}
