import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * GET /api/health
 * Simple liveness probe — returns 200 with a JSON status object.
 * No secrets or private data are exposed.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
