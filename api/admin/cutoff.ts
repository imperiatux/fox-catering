import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminSession } from '../lib/auth';
import { getCutoffOverride, setCutoffOverride } from '../lib/cutoff-override';
import { getCutoff } from '../lib/validation';

/**
 * GET  /api/admin/cutoff  — returns current cutoff state
 * POST /api/admin/cutoff  — sets override: { enabled: boolean, hour?, minute? }
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyAdminSession(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const override = getCutoffOverride();
    const { hour, minute, cutoffEnabled } = getCutoff();
    return res.status(200).json({
      cutoffEnabled,
      cutoffHour: hour,
      cutoffMinute: minute,
      overrideActive: override !== null,
    });
  }

  if (req.method === 'POST') {
    const { enabled, hour, minute } = (req.body ?? {}) as {
      enabled?: boolean;
      hour?: number;
      minute?: number;
    };

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: '`enabled` (boolean) is required' });
    }

    if (!enabled) {
      // Disable cutoff entirely — ordering always open
      setCutoffOverride({ enabled: false });
    } else {
      // Re-enable with specific time or clear override to restore env/default
      if (hour !== undefined || minute !== undefined) {
        const h = typeof hour === 'number' ? hour : getCutoff().hour;
        const m = typeof minute === 'number' ? minute : getCutoff().minute;
        setCutoffOverride({ enabled: true, hour: h, minute: m });
      } else {
        // No custom time supplied — clear override, fall back to env vars / default
        setCutoffOverride(null);
      }
    }

    const { hour: newHour, minute: newMinute, cutoffEnabled } = getCutoff();
    return res.status(200).json({
      cutoffEnabled,
      cutoffHour: newHour,
      cutoffMinute: newMinute,
      overrideActive: getCutoffOverride() !== null,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
